import {
  Before,
  DataTable,
  defineParameterType,
  setDefaultTimeout,
  supportCodeLibraryBuilder,
} from '@cucumber/cucumber';
import memory from '@qavajs/memory';
import { getValidation, getPollValidation } from '@qavajs/validation';
import { importConfig, importMemory } from './importConfig';
import type { IQavajsWorld, Validation } from './IQavajsWorld';
import { executeTest } from './executeTest';
import { MemoryValue } from './MemoryValue';
const configPath = process.env.CONFIG as string;
const profile = process.env.PROFILE as string;
const config = importConfig(configPath, profile);
const memoryValues = JSON.parse(process.env.MEMORY_VALUES as string);

try {
  const TestCaseRunner = require('@cucumber/cucumber/lib/runtime/test_case_runner').default;
  if (typeof TestCaseRunner?.prototype?.isSkippingSteps !== 'function') {
    throw new Error('isSkippingSteps is not a function');
  }
  TestCaseRunner.prototype.isSkippingSteps = function (this: any) {
    return this.testStepResults.some((stepResult: any) => {
      return !['PASSED', 'FAILED'].includes(stepResult.status) || (stepResult.status === 'FAILED' && stepResult.exception?.type !== 'SoftAssertionError')
    });
  };
} catch {
  console.warn('[qavajs] soft assertion step-continuation is not available on this version of @cucumber/cucumber');
}

type StepDefinitions = ReturnType<typeof supportCodeLibraryBuilder.buildStepDefinitions>['stepDefinitions'];

let stepDefinitionsCache: { configs: unknown[], length: number, last: unknown, definitions: StepDefinitions } | undefined;

/**
 * Step definitions built from the support code library builder.
 * Building them is expensive, so they are cached until step definition configs change
 * (new step registered, step overridden or builder reset).
 */
export function getStepDefinitions(): StepDefinitions {
  const configs: unknown[] = (supportCodeLibraryBuilder as any).stepDefinitionConfigs ?? [];
  const last = configs[configs.length - 1];
  const cache = stepDefinitionsCache;
  if (cache && cache.configs === configs && cache.length === configs.length && cache.last === last) {
    return cache.definitions;
  }
  const definitions = supportCodeLibraryBuilder.buildStepDefinitions().stepDefinitions;
  stepDefinitionsCache = { configs, length: configs.length, last, definitions };
  return definitions;
}

export async function executeStep(this: IQavajsWorld, text: string, extraParam?: DataTable | string) {
  const steps = getStepDefinitions().filter(s => s.matchesStepName(text));
  if (steps.length === 0) throw new Error(`Step '${text}' is not defined`);
  if (steps.length > 1) throw new Error(`Step '${text}' matches multiple step definitions`);
  const step = steps[0];
  const { parameters } = await step.getInvocationParameters({ step: { text }, world: this } as any);
  try {
    await step.code.apply(this, [...parameters, extraParam]);
  } catch (err: any) {
    err.message = `${text}\n${err.message}`;
    throw err;
  }
}

export { MemoryValue };

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
  regexp: /((?:is |do |does |to )?(not |to not )?(?:to )?(?:be )?(softly )?(equal|strictly equal|deeply equal|have member|match|contain|above|below|greater than|less than|have type|have property|match schema|include members|satisfy|case insensitive equal|deeply strictly equal)(?:s|es| to)?)/,
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
  this.executeTest = executeTest;
  this.getValue = (expression: string) => memory.getValue(expression);
  this.setValue = (key: string, value: any) => memory.setValue(key, value);
  this.validation = function (type: string) {
    const validation = getValidation(type) as Validation;
    validation.poll = getPollValidation(type);
    return validation;
  }
});

setDefaultTimeout(parseInt(process.env.DEFAULT_TIMEOUT as string));
