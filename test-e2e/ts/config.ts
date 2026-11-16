import { Constants } from './memory';
import { IQavajsConfig } from "../../index";

export default {
  unexpected: 32,
  paths: ['test-e2e/features/*.feature'],
  require: [
    'test-e2e/ts/step_definitions/*.ts'
  ],
  format: [
    ['@qavajs/console-formatter'],
    ['junit', 'report/junit.xml']
  ],
  formatOptions: {
    'q': 42
  },
  memory: new Constants(),
  defaultTimeout: 20000,
  parallel: 1
} as IQavajsConfig;

export const stringMemory = {
  unexpected: 32,
  paths: ['test-e2e/features/*.feature'],
  require: [
    'test-e2e/ts/step_definitions/*.ts'
  ],
  format: [
    ['@qavajs/console-formatter'],
    ['junit', 'report/junit.xml']
  ],
  memory: './test-e2e/ts/memory/index.ts',
  defaultTimeout: 20000,
  parallel: 1
} as IQavajsConfig;
