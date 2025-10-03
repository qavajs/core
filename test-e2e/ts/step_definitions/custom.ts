import {
    DataTable,
    When,
    Override,
    Fixture,
    IQavajsWorld,
    Validation,
    MemoryValue,
    Template,
    BeforeExecution,
    AfterExecution
} from '../../../index';
import { expect } from '@qavajs/validation';
//@ts-ignore
import moduleCJS from '../../modules/module.cjs';

let valueInCoordinator = 0;
BeforeExecution(async function () {
    valueInCoordinator = 1;
});

AfterExecution(async function () {
    expect(valueInCoordinator).toEqual(1);
});

Fixture('testFixture', async function(this: IQavajsWorld) {
    console.log('setup test fixture');
    this.memory.setValue('valueFromFixture', 'qavajsFixture');
    return function () {
        console.log('teardown test fixture');
    }
});

When('I do test', async function() {});

Override('I do test', async function() {
    console.log('I am overridden')
});

When('I do smth async', async function() {
    await new Promise<void>(resolve => {
        setTimeout(() => resolve(), 12000);
    });
});

When('I verify that config loaded', async function() {
    expect(this.config.defaultTimeout).toEqual(20000);
});

When('I verify that memory loaded', async function() {
    expect(this.memory.getValue('$customValue')).toEqual('ts');
});

When('I verify that process env loaded', async function() {
    expect(process.env.CONFIG).not.toBeUndefined();
    expect(process.env.PROFILE).not.toBeUndefined();
    expect(process.env.MEMORY_VALUES).toEqual('{}');
    expect(process.env.CLI_ARGV).toContain('--qavaBoolean --qavaValue 42');
    expect(process.env.DEFAULT_TIMEOUT).toEqual('20000');
    expect(process.env.CURRENT_SCENARIO_NAME).toEqual('verify process env');
});

When('I import cjs', async function() {
    expect(moduleCJS()).toEqual(`I'm cjs`);
});

When('I import esm', async function() {
    //@ts-ignore
    const moduleESM = await import('../../modules/module.mjs');
    expect(moduleESM.default()).toEqual(`I'm esm`);
});

When('I execute composite step', async function (this: IQavajsWorld) {
    await this.executeStep('Nested step "42"');
    const customDataTable = new DataTable([['1', '2', '3']])
    await this.executeStep('Data table step:', customDataTable);
    expect(this.memory.getValue('$nestedValue')).toEqual('42');
    expect(this.memory.getValue('$dataTable')).toDeepEqual({ rawTable: [['1', '2', '3']]});
});

When('Nested step {string}', async function(val) {
    this.memory.setValue('nestedValue', val);
});

When('Data table step:', function (dataTable) {
    this.memory.setValue('dataTable', dataTable);
});

When('Read memory {value} from cucumber type', async function(memoryValue: MemoryValue) {
    expect(memoryValue.value()).toEqual('ts');
});

When('write {string} to {value} value', async function(value: string, key: MemoryValue) {
    key.set(value);
    expect(this.memory.getValue('$'+key.expression)).toEqual(value);
});

When('I expect {value} {validation} {value}', async function(value1: MemoryValue, validate: Validation, value2: MemoryValue) {
    validate(value1.value(), value2.value());
});

When('I click {string} and verify {string}', Template((locator: string, expected: string) => `
    I expect '${expected}' to equal '42'
    I expect '42' to equal '${expected}'
`));