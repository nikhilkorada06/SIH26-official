import argparse
import logging
from pathlib import Path

import pandas as pd


# ---------------------------------------------------------
# Logging setup
# ---------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s"
)

log = logging.getLogger(__name__)


# ---------------------------------------------------------
# Required columns
# ---------------------------------------------------------

REQUIRED_PRIMARY_COLS = {
    "user_id",
    "name",
    "dob",
    "phone",
    "email",
    "address",
}

REQUIRED_SOURCE_COLS = {
    "record_id",
    "name",
    "dob",
    "phone",
    "email",
    "address",
}


# ---------------------------------------------------------
# Load CSV
# ---------------------------------------------------------

def load_csv(path: Path) -> pd.DataFrame:
    """Load a CSV with a clear error if it is missing or empty."""

    if not path.exists():
        raise FileNotFoundError(
            f"Expected input file not found: {path}. "
            f"Run the raw data generation script first."
        )

    df = pd.read_csv(path)

    if df.empty:
        raise ValueError(
            f"{path} loaded but contains zero rows."
        )

    return df


# ---------------------------------------------------------
# Validate columns
# ---------------------------------------------------------

def validate_columns(
    df: pd.DataFrame,
    required: set,
    source_name: str
) -> None:
    """Check whether the dataframe contains required columns."""

    missing = required - set(df.columns)

    if missing:
        raise ValueError(
            f"{source_name} is missing required column(s): "
            f"{sorted(missing)}. "
            f"Found columns: {list(df.columns)}"
        )


# ---------------------------------------------------------
# Ensure source has user_id
# ---------------------------------------------------------

def ensure_user_id(
    source_df: pd.DataFrame,
    users_df: pd.DataFrame,
    source_name: str
) -> pd.DataFrame:
    """
    Guarantee that the source dataframe has a user_id column.

    If user_id already exists, use it.

    Otherwise, fall back to positional alignment:
    education row N -> users row N
    employment row N -> users row N

    This fallback is only for the synthetic prototype.
    A real system should use a genuine foreign-key relationship.
    """

    df = source_df.copy()

    # If user_id already exists, nothing to do.
    if "user_id" in df.columns:
        return df

    log.warning(
        "%s has no 'user_id' column. "
        "Falling back to POSITIONAL alignment "
        "(row N assumed to belong to users.csv row N). "
        "This is fragile. Add a real 'user_id' foreign key "
        "to the raw data generator for long-term use.",
        source_name,
    )

    # We cannot safely align if row counts are different.
    if len(df) != len(users_df):
        raise ValueError(
            f"Cannot positionally align {source_name} "
            f"({len(df)} rows) with users.csv "
            f"({len(users_df)} rows). "
            f"Row counts differ, so there is no safe way "
            f"to guess the linkage. Add a 'user_id' column instead."
        )

    # Add user_id based on row position.
    df["user_id"] = users_df["user_id"].values

    return df


# ---------------------------------------------------------
# Create training pairs
# ---------------------------------------------------------

def create_pairs(
    primary_df: pd.DataFrame,
    source_df: pd.DataFrame,
    source_name: str
) -> pd.DataFrame:
    """
    Create every possible primary-source pair.

    Example:

    5 primary users × 5 education records = 25 pairs

    A pair receives:
        label = 1 -> same person
        label = 0 -> different person
    """

    primary = primary_df.add_prefix("primary_")
    source = source_df.add_prefix("source_")

    # Temporary key used to create a Cartesian product.
    primary["_key"] = 1
    source["_key"] = 1

    pairs = (
        primary
        .merge(source, on="_key")
        .drop(columns="_key")
    )

    # Label the pair.
    pairs["label"] = (
        pairs["primary_user_id"]
        == pairs["source_user_id"]
    ).astype(int)

    # Put source column at the beginning.
    pairs.insert(0, "source", source_name)

    return pairs


# ---------------------------------------------------------
# Check whether every user has a matching source record
# ---------------------------------------------------------

def check_coverage(
    users_df: pd.DataFrame,
    pairs_df: pd.DataFrame,
    source_name: str
) -> None:
    """Warn if any user has no matching record in a source."""

    matched_ids = set(
        pairs_df.loc[
            pairs_df["label"] == 1,
            "primary_user_id"
        ]
    )

    missing = (
        set(users_df["user_id"])
        - matched_ids
    )

    if missing:
        log.warning(
            "%d user(s) have NO matching record in '%s': %s",
            len(missing),
            source_name,
            sorted(missing),
        )


# ---------------------------------------------------------
# Main function
# ---------------------------------------------------------

def main():

    parser = argparse.ArgumentParser(
        description=(
            "Build labeled training pairs for "
            "SAES identity matching."
        )
    )

    parser.add_argument(
        "--raw-dir",
        type=Path,
        default=Path("data/raw"),
    )

    parser.add_argument(
        "--processed-dir",
        type=Path,
        default=Path("data/processed"),
    )

    parser.add_argument(
        "--output-name",
        type=str,
        default="training_pairs.csv",
    )

    args = parser.parse_args()

    # Create processed directory if it doesn't exist.
    args.processed_dir.mkdir(
        parents=True,
        exist_ok=True
    )

    # -----------------------------------------------------
    # Load files
    # -----------------------------------------------------

    try:

        users = load_csv(
            args.raw_dir / "users.csv"
        )

        education = load_csv(
            args.raw_dir / "education.csv"
        )

        employment = load_csv(
            args.raw_dir / "employment.csv"
        )

    except (FileNotFoundError, ValueError) as e:

        log.error(str(e))
        raise SystemExit(1)

    # -----------------------------------------------------
    # Validate columns
    # -----------------------------------------------------

    validate_columns(
        users,
        REQUIRED_PRIMARY_COLS,
        "users.csv"
    )

    validate_columns(
        education,
        REQUIRED_SOURCE_COLS,
        "education.csv"
    )

    validate_columns(
        employment,
        REQUIRED_SOURCE_COLS,
        "employment.csv"
    )

    # -----------------------------------------------------
    # Check duplicate user IDs
    # -----------------------------------------------------

    if users["user_id"].duplicated().any():

        raise ValueError(
            "users.csv contains duplicate user_id values. "
            "user_id must be unique."
        )

    # -----------------------------------------------------
    # Make sure source records have user_id
    # -----------------------------------------------------

    education = ensure_user_id(
        education,
        users,
        "education.csv"
    )

    employment = ensure_user_id(
        employment,
        users,
        "employment.csv"
    )

    # -----------------------------------------------------
    # Create education pairs
    # -----------------------------------------------------

    education_pairs = create_pairs(
        users,
        education,
        "education"
    )

    # -----------------------------------------------------
    # Create employment pairs
    # -----------------------------------------------------

    employment_pairs = create_pairs(
        users,
        employment,
        "employment"
    )

    # -----------------------------------------------------
    # Check coverage
    # -----------------------------------------------------

    check_coverage(
        users,
        education_pairs,
        "education"
    )

    check_coverage(
        users,
        employment_pairs,
        "employment"
    )

    # -----------------------------------------------------
    # Combine both datasets
    # -----------------------------------------------------

    all_pairs = pd.concat(
        [
            education_pairs,
            employment_pairs
        ],
        ignore_index=True
    )

    # -----------------------------------------------------
    # Save output
    # -----------------------------------------------------

    output_file = (
        args.processed_dir
        / args.output_name
    )

    try:

        all_pairs.to_csv(
            output_file,
            index=False
        )

    except OSError as e:

        log.error(
            "Failed to write output file %s: %s",
            output_file,
            e
        )

        raise SystemExit(1)

    # -----------------------------------------------------
    # Statistics
    # -----------------------------------------------------

    n_total = len(all_pairs)

    n_match = int(
        (all_pairs["label"] == 1).sum()
    )

    n_no_match = (
        n_total - n_match
    )

    log.info(
        "Training pairs created successfully."
    )

    log.info(
        "Total pairs: %d",
        n_total
    )

    log.info(
        "Matching pairs: %d (%.1f%%)",
        n_match,
        100 * n_match / n_total
    )

    log.info(
        "Non-matching pairs: %d (%.1f%%)",
        n_no_match,
        100 * n_no_match / n_total
    )

    log.info(
        "Saved to: %s",
        output_file
    )


# ---------------------------------------------------------
# Program entry point
# ---------------------------------------------------------

if __name__ == "__main__":
    main()