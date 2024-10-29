import {DataTable, When} from '@cucumber/cucumber';
import { expect } from 'chai';
import {Override} from '../../../utils.js';
import moduleESM from '../../modules/module.mjs';
import moduleCJS from '../../modules/module.cjs';

When('I do test', async function() {});

Override('I do test', async function() {
    console.log('I am overridden')
});

When('I do smth async', async function() {
    await new Promise(resolve => {
        setTimeout(() => resolve(), 12000);
    });
});

When('I verify that config loaded', async function() {
    expect(this.config.defaultTimeout).to.equal(20000);
});

When('I verify that memory loaded', async function() {
    expect(this.memory.getValue('$customValue')).to.equal('esm');
    expect(this.memory.getValue('$additionalValue')).to.equal(12);
});

When('I verify that process env loaded', async function() {
    expect(process.env.CONFIG).to.equal('test-e2e/esm/config.js');
    expect(process.env.PROFILE).to.equal('default');
    expect(process.env.MEMORY_VALUES).to.equal('{}');
    expect(process.env.CLI_ARGV).to.include('--qavaBoolean --qavaValue 42');
    expect(process.env.DEFAULT_TIMEOUT).to.equal('20000');
    expect(process.env.CURRENT_SCENARIO_NAME).to.equal('verify process env');
});

When('I import cjs', async function() {
    expect(moduleCJS()).to.equal(`I'm cjs`)
});

When('I import esm', async function() {
    expect(moduleESM()).to.equal(`I'm esm`)
});

When('I execute composite step', async function () {
    await this.executeStep('Nested step "42"');
    const customDataTable = new DataTable([['1', '2', '3']])
    await this.executeStep('Data table step:', customDataTable);
    expect(this.memory.getValue('$nestedValue')).to.equal('42');
    expect(this.memory.getValue('$dataTable')).to.deep.equal({ rawTable: [['1', '2', '3']]});
});

When('Nested step {string}', async function(val) {
    this.memory.setValue('nestedValue', val);
});

When('Data table step:', function (dataTable) {
    this.memory.setValue('dataTable', dataTable);
});

When('Read memory {value} from cucumber type', async function(memoryValue) {
    expect(memoryValue.value()).to.equal('esm');
});

When('write {string} to {value} value', async function(value, key) {
    key.set(value);
    expect(this.memory.getValue('$'+key.expression)).to.equal(value);
});

When('I expect {string} {validation} {string}', async function(value1, validate, value2) {
    validate(value1, value2);
});