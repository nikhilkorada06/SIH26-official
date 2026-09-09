import axios from "axios";
import type { Connector } from "./Connector.js";
import type { IntegrationRequest } from "../types/IntegrationRequest.js";
import type { IntegrationResponse } from "../types/IntegrationResponse.js";
import { XmlParser } from "../parsers/XmlParser.js";

/**
 * A class that implements the Connector interface for SOAP-based integrations.
 */
export class SoapConnector implements Connector {

    private parser = new XmlParser();

    /**
     * execute
     * This method executes a SOAP request based on the provided IntegrationRequest.
     * @param request IntegrationRequest
     * @returns Promise<IntegrationResponse>
     */
    async execute(
        request: IntegrationRequest
    ): Promise<IntegrationResponse> {

        const xmlRequest = `
            <?xml version="1.0" encoding="UTF-8"?>
            <EmploymentRequest>
                <CitizenId>${request.citizenId}</CitizenId>
            </EmploymentRequest>
        `;

        const response = await axios.post(
            "http://localhost:5002/soap/employment",
            xmlRequest,
            {
                headers: {
                    "Content-Type": "text/xml"
                }
            }
        );

        const parsedData = this.parser.parse(response.data);

        return {
            success: true,
            data: parsedData
        };
    }
}
