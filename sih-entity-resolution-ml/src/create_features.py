"""
Create numerical features from labeled record pairs.

1 = same person
0 = different person
"""

import logging
import re
from datetime import datetime
from pathlib import Path

import pandas as pd

try:
    from rapidfuzz import fuzz
except ImportError as e:
    raise ImportError(
        "rapidfuzz is required. Install it using: pip install rapidfuzz"
    ) from e


# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s"
)

log = logging.getLogger(__name__)

INPUT_FILE = Path("data/processed/training_pairs.csv")
OUTPUT_FILE = Path("data/processed/training_features.csv")


REQUIRED_COLS = {
    "primary_name",
    "source_name",
    "primary_dob",
    "source_dob",
    "primary_phone",
    "source_phone",
    "primary_email",
    "source_email",
    "primary_address",
    "source_address",
    "label",
}


DOB_FORMATS = (
    "%Y-%m-%d",
    "%d/%m/%Y",
    "%d-%m-%Y",
    "%m/%d/%Y",
)


ID_COLS = [
    "source",
    "primary_user_id",
    "source_user_id",
    "source_record_id",
    "primary_name",
    "source_name",
]


# ---------------------------------------------------------
# Text normalization
# ---------------------------------------------------------

def normalize_text(value) -> str:
    """
    Normalize names and addresses.

    Example:
        "Rahul Kumar!" -> "rahul kumar"
    """

    if pd.isna(value):
        return ""

    value = str(value).lower().strip()

    value = re.sub(
        r"[^a-z0-9\s]",
        "",
        value
    )

    value = re.sub(
        r"\s+",
        " ",
        value
    )

    return value


# ---------------------------------------------------------
# Email normalization
# ---------------------------------------------------------

def normalize_email(value) -> str:
    """
    Normalize email without removing meaningful
    characters such as @ and .
    """

    if pd.isna(value):
        return ""

    return str(value).strip().lower()


# ---------------------------------------------------------
# Phone normalization
# ---------------------------------------------------------

def normalize_phone(value) -> str:
    """
    Normalize phone numbers.

    Handles:
        9876543210
        +91 9876543210
        0919876543210
    """

    if pd.isna(value):
        return ""

    digits = re.sub(
        r"\D",
        "",
        str(value)
    )

    # +91XXXXXXXXXX
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]

    # 0XXXXXXXXXX
    elif digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]

    return digits


# ---------------------------------------------------------
# DOB parsing
# ---------------------------------------------------------

def parse_dob(value):
    """
    Convert different DOB formats into a Python date.
    """

    if pd.isna(value):
        return None

    value = str(value).strip()

    for fmt in DOB_FORMATS:

        try:
            return datetime.strptime(
                value,
                fmt
            ).date()

        except ValueError:
            continue

    log.warning(
        "Could not parse DOB value: %r",
        value
    )

    return None


# ---------------------------------------------------------
# Name similarity
# ---------------------------------------------------------

def name_similarity(name1, name2) -> float:
    """
    Calculate fuzzy similarity between names.

    Returns a value between 0 and 1.
    """

    n1 = normalize_text(name1)
    n2 = normalize_text(name2)

    if not n1 or not n2:
        return 0.0

    return (
        fuzz.token_sort_ratio(n1, n2)
        / 100
    )


# ---------------------------------------------------------
# Address similarity
# ---------------------------------------------------------

def address_similarity(address1, address2) -> float:
    """
    Calculate fuzzy similarity between addresses.

    Returns a value between 0 and 1.
    """

    a1 = normalize_text(address1)
    a2 = normalize_text(address2)

    if not a1 or not a2:
        return 0.0

    return (
        fuzz.token_set_ratio(a1, a2)
        / 100
    )


# ---------------------------------------------------------
# DOB features
# ---------------------------------------------------------

def dob_features(dob1, dob2):
    """
    Return:

        dob_match
        dob_day_diff

    dob_day_diff = -1 means one or both DOBs
    could not be parsed.
    """

    d1 = parse_dob(dob1)
    d2 = parse_dob(dob2)

    if d1 is None or d2 is None:
        return 0, -1

    return (
        int(d1 == d2),
        abs((d1 - d2).days)
    )


# ---------------------------------------------------------
# Email match
# ---------------------------------------------------------

def email_match(email1, email2) -> int:
    """
    Return 1 if emails match exactly,
    otherwise 0.
    """

    e1 = normalize_email(email1)
    e2 = normalize_email(email2)

    if not e1 or not e2:
        return 0

    return int(e1 == e2)


# ---------------------------------------------------------
# Phone match
# ---------------------------------------------------------

def phone_match(phone1, phone2) -> int:
    """
    Return 1 if normalized phone numbers match,
    otherwise 0.
    """

    p1 = normalize_phone(phone1)
    p2 = normalize_phone(phone2)

    if not p1 or not p2:
        return 0

    return int(p1 == p2)


# ---------------------------------------------------------
# Create features
# ---------------------------------------------------------

def create_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Convert raw record pairs into numerical ML features.
    """

    features = pd.DataFrame(
        index=df.index
    )

    # Keep identifiers so we can trace
    # a feature row back to the original pair.
    for col in ID_COLS:

        if col in df.columns:
            features[col] = df[col]

    # -------------------------------
    # Name similarity
    # -------------------------------

    features["name_similarity"] = [
        name_similarity(
            name1,
            name2
        )
        for name1, name2
        in zip(
            df["primary_name"],
            df["source_name"]
        )
    ]

    # -------------------------------
    # DOB features
    # -------------------------------

    dob_pairs = [
        dob_features(
            dob1,
            dob2
        )
        for dob1, dob2
        in zip(
            df["primary_dob"],
            df["source_dob"]
        )
    ]

    features["dob_match"] = [
        pair[0]
        for pair in dob_pairs
    ]

    features["dob_day_diff"] = [
        pair[1]
        for pair in dob_pairs
    ]

    # -------------------------------
    # Phone
    # -------------------------------

    features["phone_match"] = [
        phone_match(
            phone1,
            phone2
        )
        for phone1, phone2
        in zip(
            df["primary_phone"],
            df["source_phone"]
        )
    ]

    # -------------------------------
    # Email
    # -------------------------------

    features["email_match"] = [
        email_match(
            email1,
            email2
        )
        for email1, email2
        in zip(
            df["primary_email"],
            df["source_email"]
        )
    ]

    # -------------------------------
    # Address
    # -------------------------------

    features["address_similarity"] = [
        address_similarity(
            address1,
            address2
        )
        for address1, address2
        in zip(
            df["primary_address"],
            df["source_address"]
        )
    ]

    # -------------------------------
    # Target
    # -------------------------------

    features["label"] = df["label"].values

    return features


# ---------------------------------------------------------
# Validate columns
# ---------------------------------------------------------

def validate_columns(df: pd.DataFrame) -> None:

    missing = (
        REQUIRED_COLS
        - set(df.columns)
    )

    if missing:

        raise ValueError(
            "Input file is missing required "
            f"column(s): {sorted(missing)}. "
            f"Found columns: {list(df.columns)}"
        )


# ---------------------------------------------------------
# Main
# ---------------------------------------------------------

def main():

    if not INPUT_FILE.exists():

        raise FileNotFoundError(
            f"{INPUT_FILE} not found. "
            "Run create_training_pairs.py first."
        )

    df = pd.read_csv(
        INPUT_FILE
    )

    if df.empty:

        raise ValueError(
            f"{INPUT_FILE} contains zero rows."
        )

    validate_columns(df)

    feature_df = create_features(df)

    # Check unparseable DOBs
    unparseable_dobs = (
        feature_df["dob_day_diff"] == -1
    ).sum()

    if unparseable_dobs:

        log.warning(
            "%d row(s) had an unparseable DOB.",
            unparseable_dobs
        )

    OUTPUT_FILE.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    try:

        feature_df.to_csv(
            OUTPUT_FILE,
            index=False
        )

    except OSError as e:

        log.error(
            "Failed to write %s: %s",
            OUTPUT_FILE,
            e
        )

        raise SystemExit(1)

    log.info(
        "Features created successfully!"
    )

    log.info(
        "Total records: %d",
        len(feature_df)
    )

    log.info(
        "Saved to: %s",
        OUTPUT_FILE
    )

    print("\nFirst 5 rows:")
    print(
        feature_df.head().to_string(
            index=False
        )
    )


# ---------------------------------------------------------
# Entry point
# ---------------------------------------------------------

if __name__ == "__main__":
    main()
