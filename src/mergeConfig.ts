/**
 * Options whose config and CLI values are concatenated (same as cucumber merges profile and CLI)
 */
const ADDITIVE_ARRAYS = new Set(['format', 'import', 'loader', 'name', 'require', 'requireModule']);
/**
 * Tag expressions from config and CLI are combined with `and`
 */
const TAG_EXPRESSIONS = new Set(['tags', 'retryTagFilter']);

export function isPlainObject(value: unknown): value is Record<string, any> {
    if (value === null || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

function wrapTagExpression(expression: string): string {
    return expression.startsWith('(') && expression.endsWith(')') ? expression : `(${expression})`;
}

/**
 * Recursively merge plain objects into a new object; any other value (arrays, class instances) from source wins
 */
function mergePlainObjects(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = { ...target };
    for (const [key, value] of Object.entries(source)) {
        if (value === undefined) continue;
        result[key] = isPlainObject(value) && isPlainObject(result[key])
            ? mergePlainObjects(result[key], value)
            : value;
    }
    return result;
}

/**
 * Merge config file values with CLI values. Inputs are not mutated.
 *
 * - `format`, `import`, `loader`, `name`, `require`, `requireModule`: CLI values are appended to config values
 * - `tags`, `retryTagFilter`: combined as `(config) and (cli)`
 * - plain objects (e.g. `formatOptions`, `worldParameters`): merged recursively
 * - anything else, including `paths`: CLI value replaces config value
 *
 * Class instances (e.g. `memory: new Memory()`) are kept by reference, so their prototype is preserved.
 */
export function mergeConfig(config: Record<string, any>, cli: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = { ...config };
    for (const [key, value] of Object.entries(cli)) {
        if (value === undefined) continue;
        const current = result[key];
        if (ADDITIVE_ARRAYS.has(key) && current !== undefined) {
            result[key] = [...[current].flat(), ...[value].flat()];
        } else if (TAG_EXPRESSIONS.has(key) && typeof current === 'string' && current && typeof value === 'string' && value) {
            result[key] = `${wrapTagExpression(current)} and ${wrapTagExpression(value)}`;
        } else if (isPlainObject(value) && isPlainObject(current)) {
            result[key] = mergePlainObjects(current, value);
        } else {
            result[key] = value;
        }
    }
    return result;
}
