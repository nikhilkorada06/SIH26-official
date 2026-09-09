"""
Augment training_features.csv with deliberately hard positive/negative
cases for the SAES identity matcher.

The hard cases teach the model that:
- Phone + email are strong evidence of identity.
- Name/address alone should not be enough.
- DOB can be slightly different or unavailable.
"""

import argparse
import logging
import random
from pathlib import Path

import pandas as pd


# ---------------------------------------------------------
# Logging
# ---------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s"
)

log = logging.getLogger(__name__)


# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------

REQUIRED_COLS = {
    "name_similarity",
    "dob_match",
    "dob_day_diff",
    "phone_match",
    "email_match",
    "address_similarity",
    "label",
}

DOB_UNKNOWN_SENTINEL = -1


# ---------------------------------------------------------
# Helper
# ---------------------------------------------------------

def pct(rng: random.Random, low: int, high: int) -> float:
    """
    Generate a random percentage between low and high,
    returned as a 0-1 float.

    Example:
        pct(rng, 80, 100)
        -> 0.83
    """
    return rng.randint(low, high) / 100.0


# ---------------------------------------------------------
# Hard Case 1
# ---------------------------------------------------------

def make_case_1(row: pd.Series, rng: random.Random) -> pd.Series:
    """
    Name + DOB + address look like a strong match,
    but phone and email are different.

    Expected:
        NOT MATCH
    """

    hard = row.copy()

    hard["name_similarity"] = 1.0
    hard["dob_match"] = 1
    hard["dob_day_diff"] = 0
    hard["address_similarity"] = 1.0

    hard["phone_match"] = 0
    hard["email_match"] = 0

    hard["label"] = 0

    hard["hard_case_type"] = (
        "case1_strong_profile_wrong_contact"
    )

    return hard


# ---------------------------------------------------------
# Hard Case 2
# ---------------------------------------------------------

def make_case_2(row: pd.Series, rng: random.Random) -> pd.Series:
    """
    Name is quite different,
    but phone + email match exactly.

    Expected:
        MATCH
    """

    hard = row.copy()

    hard["name_similarity"] = pct(rng, 30, 70)

    hard["phone_match"] = 1
    hard["email_match"] = 1

    hard["label"] = 1

    hard["hard_case_type"] = (
        "case2_weak_name_strong_contact"
    )

    return hard


# ---------------------------------------------------------
# Hard Case 3
# ---------------------------------------------------------

def make_case_3(row: pd.Series, rng: random.Random) -> pd.Series:
    """
    Name + DOB + address look almost identical,
    but phone and email are different.

    Expected:
        NOT MATCH
    """

    hard = row.copy()

    hard["name_similarity"] = pct(rng, 90, 100)

    hard["dob_match"] = 1
    hard["dob_day_diff"] = 0

    hard["address_similarity"] = pct(rng, 80, 100)

    hard["phone_match"] = 0
    hard["email_match"] = 0

    hard["label"] = 0

    hard["hard_case_type"] = (
        "case3_near_identical_profile_wrong_contact"
    )

    return hard


# ---------------------------------------------------------
# Hard Case 4
# ---------------------------------------------------------

def make_case_4(row: pd.Series, rng: random.Random) -> pd.Series:
    """
    Phone + email match.

    DOB is either:
    1. Slightly different
    OR
    2. Unavailable.

    Expected:
        MATCH
    """

    hard = row.copy()

    hard["name_similarity"] = pct(rng, 50, 90)

    hard["phone_match"] = 1
    hard["email_match"] = 1

    hard["label"] = 1

    # 50% chance of DOB drift,
    # 50% chance of unavailable DOB.
    if rng.random() < 0.5:

        # DOB is slightly different.
        hard["dob_match"] = 0
        hard["dob_day_diff"] = rng.randint(1, 365)

        hard["hard_case_type"] = (
            "case4_strong_contact_dob_drift"
        )

    else:

        # DOB unavailable.
        hard["dob_match"] = 0
        hard["dob_day_diff"] = DOB_UNKNOWN_SENTINEL

        hard["hard_case_type"] = (
            "case4_strong_contact_dob_unavailable"
        )

    return hard


# ---------------------------------------------------------
# Case builders
# ---------------------------------------------------------

CASE_BUILDERS = [
    make_case_1,
    make_case_2,
    make_case_3,
    make_case_4,
]


# ---------------------------------------------------------
# Create hard cases
# ---------------------------------------------------------

def create_hard_cases(
    df: pd.DataFrame,
    rng: random.Random
) -> pd.DataFrame:

    positives = df[df["label"] == 1].copy()

    if positives.empty:
        raise ValueError(
            "No label==1 rows found in the input file. "
            "Cannot create hard cases."
        )

    hard_cases = []

    for _, row in positives.iterrows():

        for builder in CASE_BUILDERS:

            hard_case = builder(row, rng)

            hard_cases.append(hard_case)

    hard_df = pd.DataFrame(hard_cases)

    # Mark these rows so we know they are synthetic.
    hard_df["is_synthetic_hard_case"] = True

    return hard_df


# ---------------------------------------------------------
# Validation
# ---------------------------------------------------------

def validate_columns(
    df: pd.DataFrame,
    source_name: str
) -> None:

    missing = REQUIRED_COLS - set(df.columns)

    if missing:
        raise ValueError(
            f"{source_name} is missing required column(s): "
            f"{sorted(missing)}. "
            f"Found columns: {list(df.columns)}"
        )


# ---------------------------------------------------------
# Main
# ---------------------------------------------------------

def main():

    parser = argparse.ArgumentParser(
        description=(
            "Generate hard-case augmentations "
            "for the SAES entity matcher."
        )
    )

    parser.add_argument(
        "--input-file",
        type=Path,
        default=Path(
            "data/processed/training_features.csv"
        ),
        help="Input feature dataset."
    )

    parser.add_argument(
        "--output-file",
        type=Path,
        default=Path(
            "data/processed/training_features_final.csv"
        ),
        help="Output augmented dataset."
    )

    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed."
    )

    args = parser.parse_args()

    # -----------------------------------------------------
    # Check input
    # -----------------------------------------------------

    if not args.input_file.exists():

        raise FileNotFoundError(
            f"{args.input_file} not found. "
            "Run create_features.py first."
        )

    # Local random generator.
    rng = random.Random(args.seed)

    # -----------------------------------------------------
    # Load data
    # -----------------------------------------------------

    log.info("Loading feature dataset...")

    df = pd.read_csv(args.input_file)

    if df.empty:

        raise ValueError(
            f"{args.input_file} exists but contains zero rows."
        )

    validate_columns(
        df,
        str(args.input_file)
    )

    log.info(
        "Original dataset: %d rows",
        len(df)
    )

    # -----------------------------------------------------
    # Mark original rows
    # -----------------------------------------------------

    df = df.copy()

    df["is_synthetic_hard_case"] = False
    df["hard_case_type"] = None

    # -----------------------------------------------------
    # Create hard cases
    # -----------------------------------------------------

    hard_df = create_hard_cases(
        df,
        rng
    )

    positive_count = int(
        (df["label"] == 1).sum()
    )

    log.info(
        "Hard cases created: %d rows "
        "(%d positive rows × %d case types)",
        len(hard_df),
        positive_count,
        len(CASE_BUILDERS)
    )

    # -----------------------------------------------------
    # Combine original + hard cases
    # -----------------------------------------------------

    final_df = pd.concat(
        [df, hard_df],
        ignore_index=True
    )

    # Shuffle the final dataset.
    final_df = final_df.sample(
        frac=1,
        random_state=args.seed
    ).reset_index(drop=True)

    # -----------------------------------------------------
    # Save
    # -----------------------------------------------------

    args.output_file.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    try:

        final_df.to_csv(
            args.output_file,
            index=False
        )

    except OSError as error:

        log.error(
            "Failed to write %s: %s",
            args.output_file,
            error
        )

        raise SystemExit(1)

    # -----------------------------------------------------
    # Display results
    # -----------------------------------------------------

    print()
    print("===================================")
    print("Hard cases created successfully!")
    print("===================================")

    print(
        f"Original dataset: {len(df)} rows"
    )

    print(
        f"Hard cases: {len(hard_df)} rows"
    )

    print(
        f"Final dataset: {len(final_df)} rows"
    )

    print(
        f"Saved to: {args.output_file}"
    )

    print()

    print("Label distribution:")

    print(
        final_df["label"].value_counts()
    )

    print()

    print("Hard case type breakdown:")

    print(
        final_df.loc[
            final_df["is_synthetic_hard_case"],
            "hard_case_type"
        ].value_counts()
    )

    print()

    print(
        "Feature columns:"
    )

    print(
        final_df.columns.tolist()
    )

    print()

    print(
        "Next step:"
    )

    print(
        "python src/train_model.py "
        "--input-file data/processed/training_features_final.csv"
    )


# ---------------------------------------------------------
# Entry point
# ---------------------------------------------------------

if __name__ == "__main__":
    main()
