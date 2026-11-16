/**
 * Colors are disabled when the stream is not a terminal or NO_COLOR is set, FORCE_COLOR enables them
 * @param stream - stream the colored text is written to
 */
export function useColors(stream: { isTTY?: boolean } = process.stdout): boolean {
    if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== '0') return true;
    if (process.env.NO_COLOR) return false;
    return Boolean(stream.isTTY);
}

const CODES = {
    bold: 1,
    dim: 2,
    red: 31,
    yellow: 33,
    cyan: 36,
} as const;

export type Style = keyof typeof CODES;

/**
 * Returns a function that wraps text into ANSI styles if colors are enabled for the stream
 * @example
 * const paint = painter(process.stderr);
 * console.error(paint('error:', 'red'));
 */
export function painter(stream: { isTTY?: boolean } = process.stdout) {
    const enabled = useColors(stream);
    return function paint(text: string, ...styles: Style[]): string {
        if (!enabled || styles.length === 0) return text;
        return `${styles.map(style => `\x1b[${CODES[style]}m`).join('')}${text}\x1b[0m`;
    };
}
