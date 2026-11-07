/**
 * Error caused by wrong cli usage or configuration.
 * Printed without a stack trace.
 */
export class UsageError extends Error {
    name = 'UsageError';
}
