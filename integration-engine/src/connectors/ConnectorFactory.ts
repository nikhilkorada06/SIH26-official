import type { Connector } from "./Connector.js";
import { RestConnector } from "./RestConnector.js";
import { SoapConnector } from "./SoapConnector.js";
import { departments } from "../config/departments.js";

/**
 * class ConnectorFactory
 * A factory for creating connector instances.
 */
export class ConnectorFactory {

    /**
     * create function
     * Creates a connector instance based on the department configuration.
     * @param department string
     * @returns Connector
     */
    static create(department: string): Connector {

        const departmentConfig = departments[department];

        if (!departmentConfig) {
            throw new Error(
                `Department '${department}' is not configured`
            );
        }

        switch (departmentConfig.protocol) {

            case "REST":
                return new RestConnector(departmentConfig);

            case "SOAP":
                return new SoapConnector();

            default:
                throw new Error(
                    `Unsupported protocol: ${departmentConfig.protocol}`
                );
        }
    }
}