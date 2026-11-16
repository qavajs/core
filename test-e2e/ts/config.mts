// .mts config is loaded as ES module: top-level await is available
import { Constants } from './memory/index.ts';
import type { IQavajsConfig } from '../../index';

const defaultTimeout: number = await Promise.resolve(20000);

export default {
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
  defaultTimeout,
  parallel: 1
} as IQavajsConfig;
