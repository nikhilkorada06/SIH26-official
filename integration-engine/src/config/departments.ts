import type { DepartmentConfig } from "./DepartmentConfig.js";

/**
 * departments object
 * A record of department configurations, keyed by department name.
 * Each department configuration includes the protocol, base URL, and endpoints for integration.
 */
export const departments: Record<string, DepartmentConfig> = {

    education: {
        name: "education",
        protocol: "REST",
        baseUrl: "http://localhost:5001",
        endpoints: {
            GET_EDUCATION: "/api/students/{citizenId}"
        }
    },

    employment: {
        name: "employment",
        protocol: "SOAP",
        baseUrl: "http://localhost:5002",
        endpoints: {
            GET_EMPLOYMENT: "/soap/employment"
        },
        responseRoot: "EmploymentResponse"
    }
};