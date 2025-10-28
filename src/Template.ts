import type { When } from '@cucumber/cucumber';

type StepDefinitionCode = Parameters<typeof When>['2'];

export function Template(scenario: (...args: any[]) => string): StepDefinitionCode {
    return new Proxy(scenario, {
        apply: async function (template, world, args) {
            const scenario = template(...args) as string;
            const steps = scenario
                .split('\n')
                .map(step => step.trim())
                .filter(step => step);
            for (const step of steps) {
                await world.executeStep(step);
            }
        },
    })
}