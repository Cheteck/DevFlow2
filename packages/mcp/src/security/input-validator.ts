/**
 * @mosaix/mcp — Minimal JSON-Schema subset validator for tool arguments.
 * Covers what tool providers actually declare: object type, required,
 * properties (string/number/boolean/array/object), enum. Anything richer
 * is accepted (fail-open on unknown keywords, fail-closed on violations).
 */

export interface ValidationFailure {
  path: string;
  message: string;
}

function checkValue(schema: Record<string, unknown>, value: unknown, path: string): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  const type = schema["type"];

  if (Array.isArray(schema["enum"])) {
    const allowed = schema["enum"] as unknown[];
    if (!allowed.some((option) => option === value)) {
      failures.push({ path, message: `must be one of ${JSON.stringify(allowed)}` });
      return failures;
    }
  }

  if (typeof type === "string") {
    const actual = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
    const matches =
      actual === type || (type === "number" && actual === "number") || (type === "integer" && Number.isInteger(value));
    if (!matches) {
      failures.push({ path, message: `must be of type ${type}` });
      return failures;
    }
  }

  if (type === "object" && typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const required = schema["required"];
    if (Array.isArray(required)) {
      for (const key of required) {
        if (typeof key === "string" && (record[key] === undefined || record[key] === null || record[key] === "")) {
          failures.push({ path: path ? `${path}.${key}` : String(key), message: "is required" });
        }
      }
    }
    const properties = schema["properties"];
    if (typeof properties === "object" && properties !== null) {
      for (const [key, subSchema] of Object.entries(properties as Record<string, unknown>)) {
        if (record[key] !== undefined && typeof subSchema === "object" && subSchema !== null) {
          failures.push(
            ...checkValue(subSchema as Record<string, unknown>, record[key], path ? `${path}.${key}` : key),
          );
        }
      }
    }
  }

  if (type === "array" && Array.isArray(value)) {
    const items = schema["items"];
    if (typeof items === "object" && items !== null) {
      value.forEach((item, index) => {
        failures.push(...checkValue(items as Record<string, unknown>, item, `${path}[${index}]`));
      });
    }
  }

  return failures;
}

export function validateToolInput(
  inputSchema: Record<string, unknown> | undefined,
  args: unknown,
): ValidationFailure[] {
  if (!inputSchema || typeof inputSchema !== "object") return [];
  const value = (args ?? {}) as unknown;
  return checkValue(inputSchema, value, "");
}
