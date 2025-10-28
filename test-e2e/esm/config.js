import { Constants } from './memory/index.js';

export default {
    paths: ['test-e2e/features/*.feature'],
    import: [
        'test-e2e/esm/step_definitions/*.js'
    ],
    format: [
        ['@qavajs/console-formatter']
    ],
    memory: [new Constants(), {additionalValue: 12}],
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
        after(result) {
            console.log(result.success);
        }
    }]
}

export const stringMemory = {
    paths: ['test-e2e/features/*.feature'],
    import: [
        'test-e2e/esm/step_definitions/*.js'
    ],
    memory: './test-e2e/esm/memory/index.js',
    format: [
        ['@qavajs/console-formatter']
    ],
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
        after(result) {
            console.log(result.success);
        }
    }]
}