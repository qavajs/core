import { defineStep, supportCodeLibraryBuilder } from '@cucumber/cucumber';

export function Override(pattern: string | RegExp, ...rest: any[]): void {
    const configs = (supportCodeLibraryBuilder as any).stepDefinitionConfigs;
    if (!Array.isArray(configs)) {
        throw new Error('Override is not compatible with this version of @cucumber/cucumber');
    }
    const definitionIndex = configs.findIndex(
        (definition: { pattern: string | RegExp }) => definition.pattern === pattern
    );
    configs.splice(definitionIndex, 1);
    (defineStep as any)(pattern, ...rest);
}
