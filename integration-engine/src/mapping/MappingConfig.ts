/**
 * MappingConfig interface defines the structure for mapping configuration objects.
 * It is a key-value pair where the key is the source field name and the value is the target field name.
 */
export interface MappingConfig {
    [sourceField: string]: string;
}