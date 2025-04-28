import {
  Before,
  DataTable,
  defineParameterType,
  setDefaultTimeout,
  supportCodeLibraryBuilder,
} from '@cucumber/cucumber';
import TestCaseRunner from '@cucumber/cucumber/lib/runtime/test_case_runner';

import memory from '@qavajs/memory';
import { getValidation, getPollValidation } from '@qavajs/validation';
import { importConfig, importMemory } from './importConfig';
import { IQavajsWorld, Validation } from './IQavajsWorld';
const configPath = process.env.CONFIG as string;
const profile = process.env.PROFILE as string;
const config = importConfig(configPath, profile);
const memoryValues = JSON.parse(process.env.MEMORY_VALUES as string);

// soft error cucumber patch
TestCaseRunner.prototype.isSkippingSteps = function (this: any) {
  return this.testStepResults.some((stepResult: any) => {
    return stepResult.status !== 'PASSED'
        && !!stepResult.exception
        && stepResult.exception.type !== 'SoftAssertionError'
  });
}

export async function executeStep(this: any, text: string, extraParam?: DataTable | string) {
  const stepDefsLibrary = supportCodeLibraryBuilder.buildStepDefinitions();
  const steps = stepDefsLibrary.stepDefinitions.filter(s => s.matchesStepName(text));
  if (steps.length === 0) throw new Error(`Step '${text}' is not defined`);
  if (steps.length > 1) throw new Error(`'${text}' matches multiple step definitions`);
  const step = steps.pop() as any;
  const { parameters } = await step.getInvocationParameters({ step: { text }, world: this } as any);
  try {
    await step.code.apply(this, [...parameters, extraParam]);
  } catch (err) {
    throw new Error(`${text}\n${err}`);
  }
}

function setValue(this: IQavajsWorld, key: string, value: any): void {
  this.memory.setValue(key, value);
}

function getValue(this: IQavajsWorld, expression: string): any {
  return this.memory.getValue(expression);
}

export class MemoryValue {
  constructor(public world: IQavajsWorld, public expression: string) {}

  /**
   * Return resolved value
   * @example
   * url.value()
   * @return any
   */
  value() { return this.world.getValue(this.expression) }

  /**
   * Set value to memory with provided key
   * @param value any - value to set
   * @example
   * url.set('https://qavajs.github.io/')
   */
  set(value: any): void { this.world.setValue(this.expression, value); }
}

function transformString(fn: (value: string) => any) {
  return function (s1: string, s2: string) {
    const expression = (s1 || s2 || '').replace(/\\"/g, '"').replace(/\\'/g, "'")
    return fn(expression);
  }
}

defineParameterType({
  name: 'value',
  regexp: /"([^"\\]*(\\.[^"\\]*)*)"|'([^'\\]*(\\.[^'\\]*)*)'/,
  transformer: function(this: IQavajsWorld, s1, s2) {
    const world = this;
    return transformString(expression => {
      return new MemoryValue(world, expression);
    })(s1, s2)
  }
});

defineParameterType({
  name: 'validation',
  regexp: /((?:is |do |does |to )?(not |to not )?(?:to )?(?:be )?(softly )?(equal|strictly equal|deeply equal|have member|match|contain|above|below|greater than|less than|have type|have property|match schema|include members)(?:s|es| to)?)/,
  transformer: type => {
    const validation = getValidation(type) as Validation;
    validation.poll = getPollValidation(type);
    validation.type = type;
    return validation;
  },
  useForSnippets: false
});

async function getMemoryInstances(config: { memory?: Object | string }) {
  const memoryObject = typeof config.memory === 'string' ? await importMemory(config.memory) : config.memory;
  return Array.isArray(memoryObject) ? memoryObject : [memoryObject];
}
/**
 * Basic initialization hook
 */
Before({name: 'qavajs init'}, async function (this: IQavajsWorld, scenario) {
  process.env.CURRENT_SCENARIO_NAME = scenario.pickle.name;
  this.config = await config;
  this.config.memory = this.config.memory ?? [];
  const memoryInstances = await getMemoryInstances(this.config);
  if (memory.setLogger) {
    memory.setLogger(this);
  }
  memory.register(Object.assign({}, ...memoryInstances, memoryValues));
  this.memory = memory;
  this.executeStep = executeStep;
  this.getValue = getValue;
  this.setValue = setValue;
  this.validation = function (type: string) {
    const validation = getValidation(type) as Validation;
    validation.poll = getPollValidation(type);
    return validation;
  }
});

setDefaultTimeout(parseInt(process.env.DEFAULT_TIMEOUT as string));
