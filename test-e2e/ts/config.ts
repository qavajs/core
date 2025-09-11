import { Constants } from './memory';
import { IRunResult } from '@cucumber/cucumber/api';
import { IQavajsConfig } from "../../index";
import externalService from "./externalService";

export default {
    unexpected: 32,
    paths: ['test-e2e/features/*.feature'],
    require: [
        'test-e2e/ts/step_definitions/*.ts'
    ],
    format: [
        ['json', 'file.json'],
    ],
    formatOptions: {
        'q': 42
    },
    memory: new Constants(),
    defaultTimeout: 20000,
    parallel: 1,
    service: [{
        before() {
            console.log('service 1 started');
        },
    }, {
        before() {
            console.log('service 2 started');
        },
        after(result: IRunResult) {
            console.log(result.success);
        }
    }, {
        ...externalService,
        options: { data: 42 }
    }],
    serviceTimeout: 20000
} as IQavajsConfig;

export const stringMemory = {
    unexpected: 32,
    paths: ['test-e2e/features/*.feature'],
    require: [
        'test-e2e/ts/step_definitions/*.ts'
    ],
    memory: './test-e2e/ts/memory/index.ts',
    defaultTimeout: 20000,
    parallel: 1,
    service: [{
        before() {
            console.log('service 1 started');
        },
    }, {
        before() {
            console.log('service 2 started');
        },
        after(result: IRunResult) {
            console.log(result.success);
        }
    }, {
        ...externalService,
        options: { data: 42 }
    }],
    serviceTimeout: 20000
} as IQavajsConfig;
