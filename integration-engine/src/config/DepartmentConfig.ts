/**
 * Configuration for a department's integration settings.
 */
export interface DepartmentConfig {
    name: string;
    protocol: "REST" | "SOAP";
    baseUrl: string;

    endpoints: {
        [operation: string]: string;
    };

    responseRoot?: string;
}