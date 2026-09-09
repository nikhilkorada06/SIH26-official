import type { MappingConfig } from "./MappingConfig.js";

/**
 * mappings object
 * This object holds the mapping configurations for different departments.
 * Each department has its own MappingConfig that defines how to map source fields to target fields.
 */
export const mappings: Record<string, MappingConfig> = {

    education: {
        student_id: "citizenId",
        student_name: "name",
        dob: "dateOfBirth",
        college: "education.institution",
        degree: "education.qualification",
        graduation_year: "education.graduationYear"
    },

    employment: {
        CitizenId: "citizenId",
        Name: "name",
        EmploymentStatus: "employment.status",
        Company: "employment.company"
    }

};