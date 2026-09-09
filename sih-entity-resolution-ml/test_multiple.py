from src.match import match_many


# ============================================================
# CURRENT PERSON
# ============================================================

current_person = {
    "name": "Rahul Sharma",
    "dob": "1998-05-12",
    "phone": "9876543210",
    "email": "rahul.sharma@gmail.com",
    "address": "Agartala Tripura"
}


# ============================================================
# 10 OTHER PERSON RECORDS
# ============================================================

candidates = [
    {
        "education_id": "EDU001",
        "name": "Rahul Sharm",
        "dob": "12/05/1998",
        "phone": "+91 9876543210",
        "email": "rahul.sharma@gmail.com",
        "address": "Agartala Tripura"
    },

    {
        "education_id": "EDU002",
        "name": "Rahul Sharma",
        "dob": "1998-05-12",
        "phone": "9123456789",
        "email": "different@gmail.com",
        "address": "Agartala Tripura"
    },

    {
        "education_id": "EDU003",
        "name": "Amit Kumar",
        "dob": "1997-08-21",
        "phone": "9876543211",
        "email": "amit@gmail.com",
        "address": "Kolkata West Bengal"
    },

    {
        "education_id": "EDU004",
        "name": "Rahul K Sharma",
        "dob": "1998-05-12",
        "phone": "9876543210",
        "email": "rahul.sharma@gmail.com",
        "address": "Agartala Tripura"
    },

    {
        "education_id": "EDU005",
        "name": "Rohit Sharma",
        "dob": "1998-05-12",
        "phone": "9876543212",
        "email": "rohit@gmail.com",
        "address": "Agartala Tripura"
    },

    {
        "education_id": "EDU006",
        "name": "Rahul Sharma",
        "dob": "1998-05-13",
        "phone": "9876543210",
        "email": "rahul.sharma@gmail.com",
        "address": "Agartala Tripura"
    },

    {
        "education_id": "EDU007",
        "name": "Suresh Das",
        "dob": "1996-11-10",
        "phone": "9123456780",
        "email": "suresh@gmail.com",
        "address": "Imphal Manipur"
    },

    {
        "education_id": "EDU008",
        "name": "Rahul Sharma",
        "dob": "12/05/1998",
        "phone": "9876543210",
        "email": "rahul.s@gmail.com",
        "address": "Agartala, Tripura"
    },

    {
        "education_id": "EDU009",
        "name": "Rahul Sharma",
        "dob": "1990-01-15",
        "phone": "9999999999",
        "email": "another@gmail.com",
        "address": "Delhi India"
    },

    {
        "education_id": "EDU010",
        "name": "Ankit Singh",
        "dob": "1995-03-18",
        "phone": "9876543215",
        "email": "ankit@gmail.com",
        "address": "Guwahati Assam"
    }
]


# ============================================================
# RUN ENTITY MATCHING
# ============================================================

results = match_many(current_person, candidates)


# ============================================================
# DISPLAY RESULTS
# ============================================================

print("\n==========================================")
print("ENTITY RESOLUTION TEST")
print("==========================================")

print("\nCURRENT PERSON:")
print("Name    :", current_person["name"])
print("DOB     :", current_person["dob"])
print("Phone   :", current_person["phone"])
print("Email   :", current_person["email"])
print("Address :", current_person["address"])

print("\n==========================================")
print("MATCHING RESULTS")
print("==========================================")

for result in results:
    print("\nCandidate:", result["source_id"])
    print("Confidence:", result["confidence"])
    print("Decision  :", result["decision"])

    print("Field Scores:")
    for field, score in result["field_scores"].items():
        print(f"  {field:<10}: {score}")
