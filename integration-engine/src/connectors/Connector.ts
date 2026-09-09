import type { IntegrationRequest } from "../types/IntegrationRequest.js";
import type { IntegrationResponse } from "../types/IntegrationResponse.js";

/**
 * A Interface of Connector that contains all the methods that a connector should implement.
 */
export interface Connector {

    /**
     * execute
     * Executes the integration request and returns a response.
     * @param request IntegrationRequest
     * @returns Promise<IntegrationResponse>
     */
    execute(
        request: IntegrationRequest
    ): Promise<IntegrationResponse>;
}