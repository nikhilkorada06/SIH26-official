"""
Entity Resolution Matcher for SAES.

Takes a primary user record and one or many
education/employment records.

Returns:
    - confidence score
    - decision
    - field-level similarity scores
"""

import datetime
import re
from pathlib import Path

import joblib
import pandas as pd
from rapidfuzz import fuzz


# =========================================================
# Configuration
# =========================================================

MODEL_FILE = Path("models/entity_matcher.pkl")

MATCH_THRESHOLD = 0.85
REVIEW_THRESHOLD = 0.60

DOB_UNKNOWN_SENTINEL = -1
DOB_UNKNOWN_REPLACEMENT = 36500

DOB_FORMATS = (
    "%Y-%m-%d",
    "%d/%m/%Y",
    "%d-%m-%Y",
    "%m/%d/%Y",
)


# =========================================================
# Normalization
# =========================================================

def normalize_text(value) -> str:
    """
    Lowercase, remove punctuation, and normalize spaces.

    Used for names and addresses.
    """

    if value is None:
        return ""

    value = str(value).strip().lower()

    # Keep only letters, numbers, and spaces.
    value = re.sub(r"[^a-z0-9\s]", "", value)

    # Collapse multiple spaces.
    value = re.sub(r"\s+", " ", value)

    return value


def normalize_email(value) -> str:
    """
    Normalize email.

    Keep @ and . because they are meaningful.
    """

    if value is None:
        return ""

    return str(value).strip().lower()


def normalize_phone(value) -> str:
    """
    Normalize Indian phone numbers.

    Examples:
        9876543210
        +91 9876543210
        09876543210

    are normalized to the same 10-digit number.
    """

    if value is None:
        return ""

    digits = re.sub(r"\D", "", str(value))

    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]

    elif digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]

    return digits


# =========================================================
# DOB
# =========================================================

def parse_dob(value):
    """
    Try supported DOB formats.

    Returns:
        datetime.date
        or None if unavailable/unparseable
    """

    if value is None:
        return None

    value = str(value).strip()

    if not value:
        return None

    for fmt in DOB_FORMATS:

        try:
            return datetime.datetime.strptime(
                value,
                fmt
            ).date()

        except ValueError:
            continue

    return None


def calculate_dob_features(dob1, dob2):
    """
    Calculate DOB match and difference in days.

    Returns:
        dob_match
        dob_day_diff
    """

    date1 = parse_dob(dob1)
    date2 = parse_dob(dob2)

    # One or both DOBs unavailable.
    if date1 is None or date2 is None:
        return 0, DOB_UNKNOWN_SENTINEL

    difference = abs(
        (date1 - date2).days
    )

    dob_match = int(
        difference == 0
    )

    return dob_match, difference


# =========================================================
# Field Similarities
# =========================================================

def calculate_name_similarity(name1, name2) -> float:
    """Return name similarity between 0 and 1."""

    a = normalize_text(name1)
    b = normalize_text(name2)

    if not a or not b:
        return 0.0

    return fuzz.token_sort_ratio(a, b) / 100.0


def calculate_address_similarity(address1, address2) -> float:
    """Return address similarity between 0 and 1."""

    a = normalize_text(address1)
    b = normalize_text(address2)

    if not a or not b:
        return 0.0

    return fuzz.token_set_ratio(a, b) / 100.0


def calculate_phone_match(phone1, phone2) -> int:
    """Return 1 if phones match, otherwise 0."""

    a = normalize_phone(phone1)
    b = normalize_phone(phone2)

    # Missing phone is NOT a match.
    if not a or not b:
        return 0

    return int(a == b)


def calculate_email_match(email1, email2) -> int:
    """Return 1 if emails match, otherwise 0."""

    a = normalize_email(email1)
    b = normalize_email(email2)

    # Missing email is NOT a match.
    if not a or not b:
        return 0

    return int(a == b)


# =========================================================
# Feature Construction
# =========================================================

def create_features(primary: dict, source: dict) -> dict:
    """
    Convert two records into the exact features
    expected by the trained model.
    """

    name_similarity = calculate_name_similarity(
        primary.get("name"),
        source.get("name")
    )

    dob_match, dob_day_diff = calculate_dob_features(
        primary.get("dob"),
        source.get("dob")
    )

    phone_match = calculate_phone_match(
        primary.get("phone"),
        source.get("phone")
    )

    email_match = calculate_email_match(
        primary.get("email"),
        source.get("email")
    )

    address_similarity = calculate_address_similarity(
        primary.get("address"),
        source.get("address")
    )

    dob_unknown = int(
        dob_day_diff == DOB_UNKNOWN_SENTINEL
    )

    return {
        "name_similarity": name_similarity,
        "dob_match": dob_match,
        "dob_day_diff": dob_day_diff,
        "phone_match": phone_match,
        "email_match": email_match,
        "address_similarity": address_similarity,
        "dob_unknown": dob_unknown,
    }


# =========================================================
# Model Loading
# =========================================================

_model_cache = {}


def load_model(
    model_file: Path = MODEL_FILE,
    force_reload: bool = False
):
    """
    Load the trained model.

    The model is cached so that repeated matching
    does not reload the .pkl file every time.
    """

    key = str(model_file.resolve())

    if force_reload or key not in _model_cache:

        if not model_file.exists():

            raise FileNotFoundError(
                f"Model not found: {model_file}\n"
                "Run train_model.py first."
            )

        try:

            package = joblib.load(model_file)

        except Exception as error:

            raise RuntimeError(
                f"Failed to load model from "
                f"{model_file}: {error}"
            ) from error

        if "model" not in package:
            raise ValueError(
                "Saved model package does not contain "
                "'model'."
            )

        if "features" not in package:
            raise ValueError(
                "Saved model package does not contain "
                "'features'."
            )

        _model_cache[key] = (
            package["model"],
            package["features"]
        )

    return _model_cache[key]


# =========================================================
# Decision
# =========================================================

def _decide(probability: float) -> str:
    """Convert probability into a business decision."""

    if probability >= MATCH_THRESHOLD:
        return "MATCH"

    if probability >= REVIEW_THRESHOLD:
        return "REVIEW"

    return "NOT_MATCH"


# =========================================================
# Feature DataFrame
# =========================================================

def _build_feature_frame(
    feature_rows: list,
    model_features: list
) -> pd.DataFrame:
    """
    Build a DataFrame in exactly the feature order
    expected by the trained model.
    """

    if not model_features:
        raise ValueError(
            "The trained model contains no feature list."
        )

    validated_rows = []

    for index, row in enumerate(feature_rows):

        missing = set(model_features) - set(row.keys())

        if missing:

            raise ValueError(
                f"Feature row {index} is missing "
                f"feature(s): {sorted(missing)}. "
                "The model and inference code may "
                "have different feature sets."
            )

        validated_rows.append(
            [row[name] for name in model_features]
        )

    X = pd.DataFrame(
        validated_rows,
        columns=model_features
    )

    # The training pipeline replaces -1 with 36500.
    if "dob_day_diff" in X.columns:

        X["dob_day_diff"] = X[
            "dob_day_diff"
        ].replace(
            DOB_UNKNOWN_SENTINEL,
            DOB_UNKNOWN_REPLACEMENT
        )

    return X


# =========================================================
# Match One Record
# =========================================================

def match_records(
    primary: dict,
    source: dict,
    model_file: Path = MODEL_FILE
) -> dict:
    """
    Compare one primary record against one source record.
    """

    results = match_many(
        primary,
        [source],
        model_file=model_file
    )

    return results[0]


# =========================================================
# Match Many Records
# =========================================================

def match_many(
    primary: dict,
    sources: list,
    model_file: Path = MODEL_FILE
) -> list:
    """
    Compare one primary record against many source records.

    This is the important function for SAES because
    one user may need to be compared against many
    education/employment records.
    """

    if not sources:
        return []

    model, model_features = load_model(
        model_file
    )

    # Create features for every candidate.
    feature_rows = [
        create_features(
            primary,
            source
        )
        for source in sources
    ]

    # Convert to model input.
    X = _build_feature_frame(
        feature_rows,
        model_features
    )

    # Predict all candidates at once.
    probabilities = model.predict_proba(X)[:, 1]

    results = []

    for source, features, probability in zip(
        sources,
        feature_rows,
        probabilities
    ):

        result = {
            "source_id": source.get(
                "education_id",
                source.get(
                    "employment_id",
                    source.get(
                        "user_id",
                        source.get("source_id")
                    )
                )
            ),

            "confidence": round(
                float(probability),
                4
            ),

            "decision": _decide(
                float(probability)
            ),

            "field_scores": {
                "name": round(
                    features["name_similarity"],
                    4
                ),

                "dob": features[
                    "dob_match"
                ],

                "phone": features[
                    "phone_match"
                ],

                "email": features[
                    "email_match"
                ],

                "address": round(
                    features[
                        "address_similarity"
                    ],
                    4
                ),
            },

            "features": features,
        }

        results.append(result)

    return results


# =========================================================
# Demo
# =========================================================

if __name__ == "__main__":

    primary_record = {
        "name": "Rahul Sharma",
        "dob": "2002-05-14",
        "phone": "9876543210",
        "email": "rahul.sharma@gmail.com",
        "address": "12 MG Road, Hyderabad",
    }

    candidate_records = [

        # -------------------------------------------------
        # Candidate 1
        # Strong MATCH
        # -------------------------------------------------

        {
            "education_id": "EDU001",
            "name": "Rahul K Sharma",
            "dob": "2002-05-14",
            "phone": "9876543210",
            "email": "rahul.sharma@gmail.com",
            "address": "12 MG Road Hyderabad",
        },

        # -------------------------------------------------
        # Candidate 2
        # Phone + email are different
        # -------------------------------------------------

        {
            "education_id": "EDU002",
            "name": "Rahul Sharma",
            "dob": "2002-05-14",
            "phone": "9000000000",
            "email": "someone.else@gmail.com",
            "address": "12 MG Road Hyderabad",
        },
    ]

    results = match_many(
        primary_record,
        candidate_records
    )

    print()
    print("===================================")
    print("SIH ENTITY RESOLUTION")
    print("===================================")

    for index, result in enumerate(
        results,
        start=1
    ):

        print()
        print(
            f"Candidate {index}"
        )

        print(
            f"Source ID  : {result['source_id']}"
        )

        print(
            f"Confidence : {result['confidence']}"
        )

        print(
            f"Decision   : {result['decision']}"
        )

        print()
        print("Field Scores:")

        for field, score in result[
            "field_scores"
        ].items():

            print(
                f"  {field:<10}: {score}"
            )
