import { XMLParser } from "fast-xml-parser";

export class XmlParser {

    private parser = new XMLParser();

    parse(xml: string): unknown {
        return this.parser.parse(xml);
    }
}