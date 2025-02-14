[![npm version](https://badge.fury.io/js/@qavajs%2Fcore.svg)](https://badge.fury.io/js/@qavajs%2Fcore)

## @qavajs/core

@qavajs framework core
          
`npm install @qavajs/core`

Run tests

`npx qavajs run --config <config> --profile <profile>`
or
`npx qavajs --config <config> --profile <profile>`

### Override memory values
In case if tests need to be run with updated memory value they can be passed via CLI (e.g run scenarios on some other url)
It can be done by passing `--memory-values` parameter which is JSON with params that need to be overridden

example

```npx qavajs run --config config.ts --memory-values '{"url": "https://github.com"}'``` 

it will override $url memory value

### Pass CLI params to workers
All params that you passed to qavajs cli will be available in CLI_ARGV environment variable in all child workers.

### Memory value parameter type
`value` parameter type provides API to access memory

```javascript
When('Read memory {value}', async function(memoryValue) {
    expect(memoryValue.value()).to.equal('ts');
});

When('Set memory {value} as {string}', async function(memoryKey, value) {
    memoryKey.set(value);
});
```

### Validation parameter type
`validation` parameter type provides API to verify values by certain condition

```javascript
When('I expect {string} {validation} {string}', async function(value1, validate, value2) {
    validate(value1, value2);
});
```

### Test Sharding
qavajs provides ability to shard your tests between different machines. To do so pass `--shard x/y` parameter in CLI,
where x - current shard, y - total number of shards.

```
npx qavajs run --config config.js --shard 1/2
npx qavajs run --config config.js --shard 2/2
```

### Execute steps from other steps
It is possible to implement complex logic using built-in qavajs steps via `executeStep` world method
```javascript
When('I do smth complex', async function() {
    await this.executeStep(`I type 'username' to 'Username Input'`);
    await this.executeStep(`I type 'password' to 'Password Input'`);
    await this.executeStep(`I click 'Login Button'`);
    await this.executeStep(`I fill following fields`, new DataTable([
        [ 'Order', '123' ],
        [ 'Delivery Location', 'New York' ]
    ]))
});
```

### World
Module extends CucumberJS world with additional entities  
 
| entity      | type     | description                                      | example                                                            |
|-------------|----------|--------------------------------------------------|--------------------------------------------------------------------|
| config      | object   | loaded config                                    | `this.config.parallel`                                             |
| executeStep | function | programmatically execute certain step definition | `await this.executeStep("I type 'username' to 'Username Input'");` |
| setValue    | function | set memory value                                 | `await this.setValue('key', 'value');`                             |
| getValue    | function | get memory value or expression                   | `await this.getValue('$key');`                                     |
| validation  | function | get validation function based                    | `await this.getValue('to equal');`                                 |

### Override step definition
`Override` function provides capability to override step implementation and avoid ambiguous exception

```typescript
import { Override } from '@qavajs/core';

When('I do test', async function () {});

Override('I do test', async function () {
    console.log('I am overridden');
});
```

### Fixture
`Fixture` provides convenient way to prepare test environment for specific test.

This example will open pdp page before test and clean cart after test
```typescript
import { Fixture } from '@qavajs/core';

Fixture('pdp', async function() {
    await this.playwright.page.goto('https://my-site/pdp');
    // fixture may return function that will be executed after test
    return async function() {
        await this.playwright.page.request.get('/cleanCart');
    }
});
```

```gherkin
Feature: feature with fixture

  @pdp
  Scenario: scenario with fixture
    When I click 'qavajs T-shirt'
    And I click 'cart icon'
    Then I expect 'qavajs T-shirt cart item' to be visible
```

### Template
`Template` provides a way to define step definition using Gherkin language

```typescript
import { When, Template } from '@qavajs/core';

When('I click {string} and verify {string}', Template((locator, expected) => `
    I click '${locator}'
    I expect '${locator} > Value' to equal '${expected}'
`));
```

### Test Execution Hooks
`BeforeExecution` and `AfterExecution` allow to define hooks that will be executed 
once before/after whole test execution

```typescript
import { BeforeExecution, AfterExecution } from '@qavajs/core';
import { Server } from './server';

const server = new Server();

BeforeExecution(async function () {
    await server.start();
});

AfterExecution(async function () {
    await server.stop();
});
```

### Service
Services is an entities that can execute logic before and after whole test run.

```typescript
import externalService from './externalService';

export default {
    service: [
        {
            options: {
                data: 42
            },
            before() {
                console.log(this.options.data);
            },
            after(result) {
                if (!result.success) process.exitCode = 1;
            }
        },
        {
            options: {
                data: 42
            },
            ...externalService
        }
    ]
}
```
There is a one minute-long default timeout for a before and after test logic to prevent entire process from freezing.
To set up a custom timeout in milliseconds use serviceTimeout property in the config file
```typescript
export default {
    serviceTimeout: 1_200_000
}
```