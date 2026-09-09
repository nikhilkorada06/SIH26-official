/**
 * A Interface that contains all the properties that an IntegrationResponse should have.
 */
export interface IntegrationResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}