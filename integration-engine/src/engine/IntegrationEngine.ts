import { ConnectorFactory } from "../connectors/ConnectorFactory.js";
import type { IntegrationRequest } from "../types/IntegrationRequest.js";
import type { IntegrationResponse } from "../types/IntegrationResponse.js";
import { DataMapper } from "../mapping/DataMapper.js";
import { mappings } from "../mapping/mappings.js";
import { departments } from "../config/departments.js";

export class IntegrationEngine {

    private mapper = new DataMapper();

    async execute(
        request: IntegrationRequest
    ): Promise<IntegrationResponse> {

        const connector = ConnectorFactory.create(
            request.department
        );

        const response = await connector.execute(request);

        if (!response.success) {
            return response;
        }

        const departmentConfig = this.getDepartmentConfig(
            request.department
        );

        const responseData =
            response.data as Record<string, unknown> | undefined;

        const departmentData =
            departmentConfig.responseRoot &&
            responseData?.[departmentConfig.responseRoot]
                ? responseData[departmentConfig.responseRoot]
                : response.data;

        const mapping =
            mappings[request.department];

        if (!mapping) {
            return {
                success: false,
                error: `Mapping not configured for department '${request.department}'`
            };
        }

        const canonicalData =
            this.mapper.map(
                departmentData as Record<string, any>,
                mapping
            );

        return {
            success: true,
            data: canonicalData
        };
    }

    private getDepartmentConfig(
        department: string
    ) {
        const departmentConfig = departments[department];

        if (!departmentConfig) {
            throw new Error(
                `Department '${department}' is not configured`
            );
        }

        return departmentConfig;
    }
}