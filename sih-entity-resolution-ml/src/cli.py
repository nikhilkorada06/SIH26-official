"""Small JSON interface used by the Node backend.

The backend sends one JSON object on stdin and receives one JSON array on
stdout. Keeping this boundary explicit avoids importing Python code into Node.
"""

import json
import sys

from src.match import match_many


def main() -> None:
    payload = json.load(sys.stdin)
    current_person = payload.get("current_person")
    candidates = payload.get("candidates")

    if not isinstance(current_person, dict):
        raise ValueError("'current_person' must be an object")
    if not isinstance(candidates, list) or not all(isinstance(item, dict) for item in candidates):
        raise ValueError("'candidates' must be a list of objects")

    json.dump(match_many(current_person, candidates), sys.stdout)
    sys.stdout.write("\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"ML matcher failed: {error}", file=sys.stderr)
        raise
