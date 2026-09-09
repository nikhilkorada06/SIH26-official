"""
Train the SIH identity-confidence classifier.

The model learns whether two records belong to the same person.

Label:
    1 = same person
    0 = different people
"""

import argparse
import json
import logging
from pathlib import Path

import joblib
import pandas as pd

from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


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

TARGET = "label"

BASE_FEATURES = [
    "name_similarity",
    "dob_match",
    "dob_day_diff",
    "phone_match",
    "email_match",
    "address_similarity",
]

DOB_UNKNOWN_SENTINEL = -1

# Approximately 100 years.
# Used when DOB could not be parsed.
DOB_UNKNOWN_REPLACEMENT = 36500


# ---------------------------------------------------------
# Load data
# ---------------------------------------------------------

def load_data(input_file: Path) -> pd.DataFrame:

    if not input_file.exists():
        raise FileNotFoundError(
            f"{input_file} not found. "
            "Run create_features.py first."
        )

    df = pd.read_csv(input_file)

    if df.empty:
        raise ValueError(
            f"{input_file} exists but contains zero rows."
        )

    return df


# ---------------------------------------------------------
# Validate and prepare features
# ---------------------------------------------------------

def validate_and_prepare(df: pd.DataFrame):

    required_columns = set(BASE_FEATURES) | {TARGET}

    missing = required_columns - set(df.columns)

    if missing:
        raise ValueError(
            f"Missing required column(s): {sorted(missing)}\n"
            f"Available columns: {list(df.columns)}"
        )

    df = df.copy()

    # -----------------------------------------------------
    # Handle unknown DOB
    # -----------------------------------------------------

    # In create_features.py:
    # -1 means DOB could not be parsed.
    #
    # We don't want -1 to look like a very small distance.
    # Otherwise the model could incorrectly interpret it
    # as "very close DOB".

    df["dob_unknown"] = (
        df["dob_day_diff"] == DOB_UNKNOWN_SENTINEL
    ).astype(int)

    df["dob_day_diff"] = df["dob_day_diff"].replace(
        DOB_UNKNOWN_SENTINEL,
        DOB_UNKNOWN_REPLACEMENT
    )

    # Final feature list
    features = BASE_FEATURES + ["dob_unknown"]

    # -----------------------------------------------------
    # Check missing values
    # -----------------------------------------------------

    if df[features].isna().any().any():

        bad_columns = (
            df[features]
            .columns[df[features].isna().any()]
            .tolist()
        )

        raise ValueError(
            f"Missing values found in feature column(s): "
            f"{bad_columns}"
        )

    if df[TARGET].isna().any():
        raise ValueError(
            f"Missing values found in target column '{TARGET}'."
        )

    # -----------------------------------------------------
    # Check labels
    # -----------------------------------------------------

    unique_labels = set(df[TARGET].unique())

    if unique_labels != {0, 1}:
        raise ValueError(
            f"Expected labels {{0, 1}}, "
            f"but found: {unique_labels}"
        )

    X = df[features]
    y = df[TARGET]

    return X, y, features


# ---------------------------------------------------------
# Safe train/test split
# ---------------------------------------------------------

def safe_split(
    X: pd.DataFrame,
    y: pd.Series,
    test_size: float,
    random_state: int
):

    """
    Safely split the dataset.

    If the dataset is large enough:
        use stratified train/test split.

    If the dataset is too small:
        train and evaluate on the full dataset.

    Full-dataset evaluation is only a sanity check,
    NOT a real measurement of model performance.
    """

    class_counts = y.value_counts()

    min_class_count = class_counts.min()

    # Very small dataset
    if len(y) < 10 or min_class_count < 2:

        log.warning(
            "Dataset is too small for a reliable train/test split "
            "(n=%d, smallest class=%d).",
            len(y),
            min_class_count
        )

        log.warning(
            "Training and evaluating on the FULL dataset."
        )

        log.warning(
            "These metrics are only a sanity check. "
            "Collect more data before trusting the model."
        )

        return X, X, y, y

    # Normal case
    try:

        return train_test_split(
            X,
            y,
            test_size=test_size,
            random_state=random_state,
            stratify=y
        )

    except ValueError as error:

        log.warning(
            "Stratified split failed: %s",
            error
        )

        log.warning(
            "Falling back to an unstratified split."
        )

        return train_test_split(
            X,
            y,
            test_size=test_size,
            random_state=random_state
        )


# ---------------------------------------------------------
# Main training function
# ---------------------------------------------------------

def main():

    # -----------------------------------------------------
    # Command-line arguments
    # -----------------------------------------------------

    parser = argparse.ArgumentParser(
        description="Train the SAES identity-confidence model."
    )

    parser.add_argument(
        "--input-file",
        type=Path,
        default=Path(
            "data/processed/training_features.csv"
        )
    )

    parser.add_argument(
        "--model-file",
        type=Path,
        default=Path(
            "models/entity_matcher.pkl"
        )
    )

    parser.add_argument(
        "--test-size",
        type=float,
        default=0.20
    )

    parser.add_argument(
        "--random-state",
        type=int,
        default=42
    )

    args = parser.parse_args()

    # -----------------------------------------------------
    # Load dataset
    # -----------------------------------------------------

    log.info("Loading training features...")

    df = load_data(args.input_file)

    log.info(
        "Dataset shape: %s",
        df.shape
    )

    # -----------------------------------------------------
    # Prepare features
    # -----------------------------------------------------

    X, y, features = validate_and_prepare(df)

    log.info(
        "Features: %s",
        features
    )

    log.info(
        "Label distribution: %s",
        y.value_counts().to_dict()
    )

    # -----------------------------------------------------
    # Train/test split
    # -----------------------------------------------------

    X_train, X_test, y_train, y_test = safe_split(
        X,
        y,
        args.test_size,
        args.random_state
    )

    log.info(
        "Training samples: %d | Testing samples: %d",
        len(X_train),
        len(X_test)
    )

    # -----------------------------------------------------
    # Create ML pipeline
    # -----------------------------------------------------

    model = Pipeline(
        [
            (
                "scaler",
                StandardScaler()
            ),
            (
                "classifier",
                LogisticRegression(
                    max_iter=1000,
                    class_weight="balanced"
                )
            ),
        ]
    )

    # -----------------------------------------------------
    # Train
    # -----------------------------------------------------

    log.info(
        "Training Logistic Regression model..."
    )

    model.fit(
        X_train,
        y_train
    )

    # -----------------------------------------------------
    # Predictions
    # -----------------------------------------------------

    predictions = model.predict(X_test)

    probabilities = model.predict_proba(
        X_test
    )[:, 1]

    # -----------------------------------------------------
    # Classification report
    # -----------------------------------------------------

    print(
        "\n========== CLASSIFICATION REPORT ==========\n"
    )

    report_text = classification_report(
        y_test,
        predictions,
        zero_division=0
    )

    print(report_text)

    report_dict = classification_report(
        y_test,
        predictions,
        zero_division=0,
        output_dict=True
    )

    # -----------------------------------------------------
    # Confusion matrix
    # -----------------------------------------------------

    print(
        "========== CONFUSION MATRIX ==========\n"
    )

    matrix = confusion_matrix(
        y_test,
        predictions
    )

    print(matrix)

    # -----------------------------------------------------
    # ROC-AUC
    # -----------------------------------------------------

    auc = None

    if len(set(y_test)) == 2:

        auc = roc_auc_score(
            y_test,
            probabilities
        )

        print(
            f"\nROC-AUC: {auc:.4f}"
        )

    else:

        log.warning(
            "Only one class is present in the test set. "
            "ROC-AUC cannot be calculated."
        )

    # -----------------------------------------------------
    # Learned feature weights
    # -----------------------------------------------------

    classifier = model.named_steps[
        "classifier"
    ]

    coefficients = classifier.coef_[0]

    feature_weights = dict(
        zip(
            features,
            coefficients
        )
    )

    print(
        "\n========== LEARNED FEATURE WEIGHTS ==========\n"
    )

    for name, weight in sorted(
        feature_weights.items(),
        key=lambda item: -abs(item[1])
    ):

        print(
            f"{name:<25} {weight:+.4f}"
        )

    # -----------------------------------------------------
    # Check phone/email importance
    # -----------------------------------------------------

    top_two = [
        name
        for name, _ in sorted(
            feature_weights.items(),
            key=lambda item: -abs(item[1])
        )[:2]
    ]

    if {
        "phone_match",
        "email_match"
    }.issubset(set(top_two)):

        log.info(
            "GOOD: phone_match and email_match "
            "are among the two strongest features."
        )

    else:

        log.warning(
            "phone_match/email_match are NOT both among "
            "the two strongest features."
        )

        log.warning(
            "This is expected with a tiny synthetic dataset. "
            "We will improve the training data next."
        )

    # -----------------------------------------------------
    # Save model
    # -----------------------------------------------------

    args.model_file.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    model_package = {
        "model": model,
        "features": features
    }

    try:

        joblib.dump(
            model_package,
            args.model_file
        )

    except OSError as error:

        log.error(
            "Could not save model: %s",
            error
        )

        raise SystemExit(1)

    log.info(
        "Model saved to: %s",
        args.model_file
    )

    # -----------------------------------------------------
    # Save metrics
    # -----------------------------------------------------

    metrics_file = args.model_file.with_suffix(
        ".metrics.json"
    )

    metrics_payload = {
        "n_train": len(X_train),
        "n_test": len(X_test),
        "features": features,
        "feature_weights": {
            key: float(value)
            for key, value in feature_weights.items()
        },
        "roc_auc": (
            float(auc)
            if auc is not None
            else None
        ),
        "classification_report": report_dict
    }

    with open(
        metrics_file,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            metrics_payload,
            file,
            indent=2
        )

    log.info(
        "Metrics saved to: %s",
        metrics_file
    )


# ---------------------------------------------------------
# Program entry point
# ---------------------------------------------------------

if __name__ == "__main__":
    main()
