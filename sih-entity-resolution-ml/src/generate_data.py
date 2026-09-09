"""
Generate synthetic SAES identity data.

Creates:
    data/raw/users.csv
    data/raw/education.csv
    data/raw/employment.csv

All data is fake and used only for testing.
"""

import argparse
import logging
import random
from dataclasses import dataclass
from pathlib import Path

import pandas as pd


# ---------------------------------------------------------
# SETTINGS
# ---------------------------------------------------------

DEFAULT_USERS = 200
DEFAULT_OUTPUT = Path("data/raw")
DEFAULT_SEED = 42


# ---------------------------------------------------------
# LOGGING
# ---------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s"
)

log = logging.getLogger(__name__)


# ---------------------------------------------------------
# SAMPLE DATA
# ---------------------------------------------------------

FIRST_NAMES = [
    "Rahul", "Priya", "Arjun", "Sneha", "Aman",
    "Ananya", "Rohit", "Kavya", "Vikram", "Neha",
    "Aditya", "Pooja", "Kiran", "Meera", "Ravi",
    "Ishita", "Varun", "Divya", "Sanjay", "Nisha"
]

LAST_NAMES = [
    "Kumar", "Sharma", "Reddy", "Patel", "Singh",
    "Verma", "Gupta", "Rao", "Das", "Mishra",
    "Yadav", "Nair", "Joshi", "Mehta", "Iyer"
]

CITIES = [
    "Hyderabad", "Delhi", "Mumbai", "Bangalore",
    "Chennai", "Kolkata", "Pune", "Jaipur",
    "Lucknow", "Bhopal"
]

STREETS = [
    "MG Road", "Gandhi Nagar", "Station Road",
    "Main Road", "Lake View Road", "Nehru Street",
    "Market Road", "Park Street"
]


# ---------------------------------------------------------
# PERSON
# ---------------------------------------------------------

@dataclass
class Person:
    user_id: str
    name: str
    dob: str
    email: str
    phone: str
    address: str


# ---------------------------------------------------------
# GENERATE PHONE
# ---------------------------------------------------------

def generate_phone(rng):
    first = rng.choice(["6", "7", "8", "9"])
    remaining = "".join(
        rng.choices("0123456789", k=9)
    )
    return first + remaining


# ---------------------------------------------------------
# GENERATE DOB
# ---------------------------------------------------------

def generate_dob(rng):
    day = rng.randint(1, 28)
    month = rng.randint(1, 12)
    year = rng.randint(1990, 2005)

    return f"{day:02d}/{month:02d}/{year}"


# ---------------------------------------------------------
# GENERATE ADDRESS
# ---------------------------------------------------------

def generate_address(rng):
    house = rng.randint(1, 999)
    street = rng.choice(STREETS)
    city = rng.choice(CITIES)

    return f"{house} {street}, {city}"


# ---------------------------------------------------------
# CREATE USERS
# ---------------------------------------------------------

def build_users(number, rng):

    users = []

    used_phones = set()
    used_emails = set()

    for i in range(1, number + 1):

        first = rng.choice(FIRST_NAMES)
        last = rng.choice(LAST_NAMES)

        name = f"{first} {last}"

        dob = generate_dob(rng)

        # Generate unique phone
        phone = generate_phone(rng)

        while phone in used_phones:
            phone = generate_phone(rng)

        used_phones.add(phone)

        # Email
        email = (
            f"{first.lower()}."
            f"{last.lower()}"
            f"{i}@gmail.com"
        )

        while email in used_emails:
            email = (
                f"{first.lower()}."
                f"{last.lower()}"
                f"{rng.randint(100, 9999)}@gmail.com"
            )

        used_emails.add(email)

        address = generate_address(rng)

        users.append(
            Person(
                user_id=f"U{i:04d}",
                name=name,
                dob=dob,
                email=email,
                phone=phone,
                address=address
            )
        )

    return users


# ---------------------------------------------------------
# CREATE EDUCATION RECORDS
# ---------------------------------------------------------

def build_education(users, rng):

    records = []

    for i, person in enumerate(users, start=1):

        first, last = person.name.split(" ", 1)

        # Different ways the name may appear
        names = [
            person.name,
            f"{first} {last[0]}",
            f"{first[0]}. {last}"
        ]

        name = rng.choice(names)

        # Different DOB formats
        day, month, year = person.dob.split("/")

        dobs = [
            person.dob,
            f"{year}-{month}-{day}",
            f"{day}-{month}-{year}"
        ]

        dob = rng.choice(dobs)

        # Different phone formats
        phones = [
            person.phone,
            f"+91{person.phone}",
            f"+91 {person.phone[:5]} {person.phone[5:]}"
        ]

        phone = rng.choice(phones)

        # Address variation
        address = person.address

        if rng.random() < 0.4:
            address = "Near " + address

        records.append(
            {
                "record_id": f"E{i:04d}",
                "user_id": person.user_id,
                "name": name,
                "dob": dob,
                "email": person.email,
                "phone": phone,
                "address": address
            }
        )

    return records


# ---------------------------------------------------------
# CREATE EMPLOYMENT RECORDS
# ---------------------------------------------------------

def build_employment(users, rng):

    records = []

    for i, person in enumerate(users, start=1):

        first, last = person.name.split(" ", 1)

        names = [
            person.name,
            f"{first[0]}. {last}",
            f"{last}, {first}"
        ]

        name = rng.choice(names)

        # DOB variations
        day, month, year = person.dob.split("/")

        dobs = [
            person.dob,
            f"{year}-{month}-{day}",
            f"{day}-{month}-{year}"
        ]

        dob = rng.choice(dobs)

        # Phone variations
        phones = [
            person.phone,
            f"+91{person.phone}",
            f"+91-{person.phone}"
        ]

        phone = rng.choice(phones)

        # Address variation
        address = person.address

        if rng.random() < 0.5:
            address = (
                address
                .replace(",", "")
                .replace("Road", "Rd")
            )

        records.append(
            {
                "record_id": f"EMP{i:04d}",
                "user_id": person.user_id,
                "name": name,
                "dob": dob,
                "email": person.email,
                "phone": phone,
                "address": address
            }
        )

    return records


# ---------------------------------------------------------
# CHECK DATA
# ---------------------------------------------------------

def check_data(users, education, employment):

    user_ids = {user.user_id for user in users}

    # Check user IDs
    if len(user_ids) != len(users):
        raise ValueError("Duplicate user_id found.")

    # Check phone numbers
    phones = [user.phone for user in users]

    if len(set(phones)) != len(phones):
        raise ValueError("Duplicate phone number found.")

    # Check emails
    emails = [user.email for user in users]

    if len(set(emails)) != len(emails):
        raise ValueError("Duplicate email found.")

    # Check education IDs
    education_ids = {
        record["user_id"]
        for record in education
    }

    if education_ids != user_ids:
        raise ValueError(
            "Education records do not match users."
        )

    # Check employment IDs
    employment_ids = {
        record["user_id"]
        for record in employment
    }

    if employment_ids != user_ids:
        raise ValueError(
            "Employment records do not match users."
        )


# ---------------------------------------------------------
# SAVE FILES
# ---------------------------------------------------------

def save_data(output_dir, users, education, employment):

    output_dir.mkdir(
        parents=True,
        exist_ok=True
    )

    users_df = pd.DataFrame(
        [user.__dict__ for user in users]
    )

    education_df = pd.DataFrame(
        education
    )

    employment_df = pd.DataFrame(
        employment
    )

    check_data(
        users,
        education,
        employment
    )

    users_df.to_csv(
        output_dir / "users.csv",
        index=False
    )

    education_df.to_csv(
        output_dir / "education.csv",
        index=False
    )

    employment_df.to_csv(
        output_dir / "employment.csv",
        index=False
    )

    log.info(
        "Created %d users.",
        len(users)
    )

    log.info(
        "Created %d education records.",
        len(education)
    )

    log.info(
        "Created %d employment records.",
        len(employment)
    )


# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------

def main():

    parser = argparse.ArgumentParser(
        description="Generate synthetic SAES identity data."
    )

    parser.add_argument(
        "--num-users",
        type=int,
        default=DEFAULT_USERS
    )

    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT
    )

    parser.add_argument(
        "--seed",
        type=int,
        default=DEFAULT_SEED
    )

    args = parser.parse_args()

    if args.num_users < 1:
        raise ValueError(
            "--num-users must be at least 1."
        )

    rng = random.Random(args.seed)

    log.info(
        "Generating data for %d users...",
        args.num_users
    )

    users = build_users(
        args.num_users,
        rng
    )

    education = build_education(
        users,
        rng
    )

    employment = build_employment(
        users,
        rng
    )

    save_data(
        args.output_dir,
        users,
        education,
        employment
    )

    log.info(
        "Synthetic data generation completed successfully."
    )


if __name__ == "__main__":
    main()
