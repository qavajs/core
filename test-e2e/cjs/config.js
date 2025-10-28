const Memory = require('./memory');

module.exports = {
    default: {
        paths: ['test-e2e/features/*.feature'],
        require: [
            'test-e2e/cjs/step_definitions/*.js'
        ],
        format: [
            ['@qavajs/console-formatter']
        ],
        memory: [Memory, {additionalValue: 12}],
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
    },
    stringMemory: {
        paths: ['test-e2e/features/*.feature'],
        require: [
            'test-e2e/cjs/step_definitions/*.js'
        ],
        format: [
            ['@qavajs/console-formatter']
        ],
        memory: './test-e2e/cjs/memory/index.js',
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
}
