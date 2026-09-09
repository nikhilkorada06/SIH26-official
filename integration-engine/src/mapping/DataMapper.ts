import type { CanonicalCitizen } from "../types/CanonicalCitizen.js";
import type { MappingConfig } from "./MappingConfig.js";

export class DataMapper {

    map(
        source: Record<string, any>,
        mapping: MappingConfig
    ): CanonicalCitizen {

        const result: Record<string, any> = {};

        for (const sourceField in mapping) {

            const targetPath = mapping[sourceField];
            const value = source[sourceField];

            if (value === undefined) {
                continue;
            }

            setNestedValue(
                result,
                targetPath ?? "unknown_path",
                value
            );
        }

        return result as CanonicalCitizen;
    }

}

/**
 * Writes a value to a dot-separated path, creating intermediate objects.
 * This is shared by the standalone engine and backend mapping adapters.
 */
export function setNestedValue(
    object: Record<string, any>,
    path: string,
    value: any
): void {
    const parts = path.split(".");
    let current = object;

    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!part) continue;
        if (!current[part] || typeof current[part] !== "object") {
            current[part] = {};
        }
        current = current[part];
    }

    const lastPart = parts[parts.length - 1];
    if (lastPart) {
        current[lastPart] = value;
    }
}
