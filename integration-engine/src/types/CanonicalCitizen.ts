/**
 * This interface represents a canonical citizen object contains all the properties that a citizen should have.
 */
export interface CanonicalCitizen {
    citizenId: string;
    name: string;
    dateOfBirth?: string;
    education?: {
        qualification?: string;
        institution?: string;
        graduationYear?: number;
    };
    employment?: {
        status?: string;
        company?: string;
    };
}