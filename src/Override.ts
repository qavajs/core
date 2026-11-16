import { defineStep, supportCodeLibraryBuilder } from '@cucumber/cucumber';

/**
 * Replace step definition with the same pattern (or define a new one if there is none)
 * @example
 * Override('I open {string}', async function (url) { ... });
 */
export const Override: typeof defineStep = function (pattern: string | RegExp, ...rest: any[]): void {
    const configs = (supportCodeLibraryBuilder as any).stepDefinitionConfigs;
    if (!Array.isArray(configs)) {
        throw new Error('Override is not compatible with this version of @cucumber/cucumber');
    }
    const definitionIndex = configs.findIndex(
        (definition: { pattern: string | RegExp }) => definition.pattern === pattern
    );
    // nothing to override - just define the step (splice(-1) would remove an unrelated last step)
    if (definitionIndex !== -1) configs.splice(definitionIndex, 1);
    (defineStep as any)(pattern, ...rest);
} as typeof defineStep;
