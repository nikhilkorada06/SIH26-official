import json
from src.match import match_many


# Load input data
with open("test_data.json", "r") as file:
    data = json.load(file)


# Get current person and candidates
current_person = data["current_person"]
candidates = data["candidates"]


# Run ML entity resolution
results = match_many(current_person, candidates)


# Display results
print("\n==========================================")
print("ENTITY RESOLUTION")
print("==========================================")

print("\nCurrent Person:")
print("Name    :", current_person["name"])
print("DOB     :", current_person["dob"])
print("Phone   :", current_person["phone"])
print("Email   :", current_person["email"])
print("Address :", current_person["address"])


print("\n==========================================")
print("RESULTS")
print("==========================================")

for result in results:

    print("\n------------------------------")
    print("Source ID :", result["source_id"])
    print("Confidence:", result["confidence"])
    print("Decision  :", result["decision"])

    print("\nField Scores:")

    for field, score in result["field_scores"].items():
        print(f"  {field:<10}: {score}")
