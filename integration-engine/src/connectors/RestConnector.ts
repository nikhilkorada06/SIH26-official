import axios from "axios";
import type { Connector } from "./Connector.js";
import type { IntegrationRequest } from "../types/IntegrationRequest.js";
import type { IntegrationResponse } from "../types/IntegrationResponse.js";
import type { DepartmentConfig } from "../config/DepartmentConfig.js";

/**
 * A connector for making REST API calls.
 */
export class RestConnector implements Connector {

    /**
     * constructor
     * @param config The department configuration for this connector.
     */
    constructor(private config: DepartmentConfig) {}

    /**
     * execute
     * Executes the integration request and returns a response.
     * @param request The IntegrationRequest to execute.
     * @returns A promise resolving to the IntegrationResponse.
     */
    async execute(
        request: IntegrationRequest
    ): Promise<IntegrationResponse> {

        const endpoint =
            this.config.endpoints[request.operation];

        if (!endpoint) {
            return {
                success: false,
                error: `Operation ${request.operation} not configured`
            };
        }

        const url = `${this.config.baseUrl}${endpoint.replace(
            "{citizenId}",
            request.citizenId
        )}`;

        const response = await axios.get(url);

        return {
            success: true,
            data: response.data
        };
    }
}