import { beforeAll, describe, expect, test, vi } from 'vitest';
import { defineStep, supportCodeLibraryBuilder } from '@cucumber/cucumber';

let id = 0;
let load: typeof import('../src/load');
let world: any;

/**
 * load.ts is a cucumber support module: it reads env prepared by run.ts and registers
 * parameter types and the init hook into the support code library builder
 */
beforeAll(async () => {
    (supportCodeLibraryBuilder as any).reset(process.cwd(), () => String(id++));
    process.env.CONFIG = 'test/fixtures/config-plain.js';
    process.env.PROFILE = 'default';
    process.env.MEMORY_VALUES = JSON.stringify({ fromCli: 'cli value' });
    process.env.DEFAULT_TIMEOUT = '5000';
    load = await import('../src/load');

    const init = (supportCodeLibraryBuilder as any).beforeTestCaseHookDefinitionConfigs
        .find((hook: any) => hook.options.name === 'qavajs init');
    world = { log: vi.fn(), attach: vi.fn() };
    await init.code.call(world, { pickle: { name: 'scenario name' } });
});

describe('qavajs init hook', () => {
    test('prepares world', () => {
        expect(process.env.CURRENT_SCENARIO_NAME).toBe('scenario name');
        expect(world.config).toMatchObject({ value: 'plain-config', memory: [] });
        expect(world.getValue('$fromCli')).toBe('cli value');
        world.setValue('saved', 42);
        expect(world.getValue('$saved')).toBe(42);
        expect(world.validation('to equal')).toBeTypeOf('function');
    });

    test('sets default timeout from env', () => {
        expect((supportCodeLibraryBuilder as any).defaultTimeout).toBe(5000);
    });
});

describe('executeStep', () => {
    test('executes matching step with parameters and extra argument', async () => {
        const code = vi.fn();
        defineStep('I add {int} and {int}', code);
        await world.executeStep('I add 1 and 2', 'doc string');
        expect(code).toHaveBeenCalledWith(1, 2, 'doc string');
        expect(code.mock.contexts[0]).toBe(world);
    });

    test('resolves {value} to MemoryValue and {validation} to validation function', async () => {
        let received: any;
        defineStep('I check {value} {validation} {string}', function (value: any, validation: any, expected: string) {
            received = { value, validation };
            validation(value.value(), expected);
        });
        await world.executeStep(`I check '$fromCli' to equal "cli value"`);
        expect(received.value).toBeInstanceOf(load.MemoryValue);
        expect(received.value.expression).toBe('$fromCli');
        expect(received.validation.type).toBe('to equal');
        expect(received.validation.poll).toBeTypeOf('function');
        await expect(world.executeStep(`I check '$fromCli' to equal "other"`)).rejects.toThrow();
    });

    test('prefixes step errors with step text', async () => {
        defineStep('I fail', () => { throw new Error('boom'); });
        await expect(world.executeStep('I fail')).rejects.toThrow('I fail\nboom');
    });

    test('throws for undefined and ambiguous steps', async () => {
        defineStep(/^ambiguous step$/, () => {});
        defineStep('ambiguous step', () => {});
        await expect(world.executeStep('not defined step')).rejects.toThrow(`Step 'not defined step' is not defined`);
        await expect(world.executeStep('ambiguous step')).rejects.toThrow('matches multiple step definitions');
    });

    test('step definitions are built once until a step is added', async () => {
        const build = vi.spyOn(supportCodeLibraryBuilder, 'buildStepDefinitions');
        defineStep('cached step', () => {});
        await world.executeStep('cached step');
        await world.executeStep('cached step');
        expect(build).toHaveBeenCalledTimes(1);
        const added = vi.fn();
        defineStep('added later', added);
        await world.executeStep('added later');
        expect(added).toHaveBeenCalledTimes(1);
        expect(build).toHaveBeenCalledTimes(2);
        build.mockRestore();
    });
});

describe('soft assertions', () => {
    const { default: TestCaseRunner } = require('@cucumber/cucumber/lib/runtime/test_case_runner');
    const isSkipping = (...testStepResults: object[]) => TestCaseRunner.prototype.isSkippingSteps.call({ testStepResults });

    test('soft assertion failure does not skip next steps', () => {
        expect(isSkipping({ status: 'PASSED' }, { status: 'FAILED', exception: { type: 'SoftAssertionError' } })).toBe(false);
    });

    test('hard failure and other statuses skip next steps', () => {
        expect(isSkipping({ status: 'FAILED', exception: { type: 'AssertionError' } })).toBe(true);
        expect(isSkipping({ status: 'UNDEFINED' })).toBe(true);
        expect(isSkipping({ status: 'PASSED' })).toBe(false);
    });
});
