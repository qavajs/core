# Change Log

All notable changes to the "@qavajs/core" will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

:rocket: - new feature  
:beetle: - bugfix  
:x: - deprecation/removal  
:pencil: - chore  
:microscope: - experimental

## [2.12.0]
- :rocket: added `to deeply strictly equal` matcher

## [2.11.0]
- :microscope: added `executeTest` world method that allow to call other test from feature file
```javascript
When('I do smth very complex', async function() {
    await this.executeTest(`features/Login.feature`, `Login Test`);
});
```

## [2.10.0]
- :x: removed hardcoded `swc` flag in favor of project specific configuration
```json
{
  "ts-node": {
    "swc": true,
    "compilerOptions": {
      "target": "es2020"
    }
  }
}
```

## [2.9.0]
- :x: qavajs sharding removed in favor of cucumberjs built-in
  https://github.com/cucumber/cucumber-js/issues/2303

## [2.8.1]
- :beetle: updated `@qavajs/validation` with proper ts declarations

## [2.8.0]
- :rocket: updated `@qavajs/validation` without chai dependency

## [2.7.0]
- :rocket: added capability to print report file path
- :beetle: fixed issue with overwriting config properties by CLI inputs

## [2.6.0]
- :rocket: added `to satisfy` validation to verify user-defined expectation provided as predicate
```Gherkin
Then I expect '$value' to satisfy '$either(1, 2)'
```
where `$either` is a function
```typescript
function either(...expected) {
    return function (actual) {
        return expected.includes(actual)
    }
}
```

## [2.5.2]
- :beetle: re-throw original error in `executeStep`

## [2.5.1]
- :beetle: fixed issue with improper skipping logic

## [2.5.0]
- :rocket: added capability to provide `softly` modifier to perform soft validations
```gherkin
Then I expect '$variable' to softly equal '42'
```

## [2.4.0]
- :microscope: introduced `BeforeExecution` and `AfterExecution` hooks

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
- :microscope: added capability to define `Template`

```typescript
import { When, Template } from '@qavajs/core';

When('I click {string} and verify {string}', Template((locator, expected) => `
    I click '${locator}'
    I expect '${locator} > Value' to equal '${expected}'
`));
```

## [2.3.0]
- :microscope: added capability to define `Fixture`
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
- :rocket: added re-export of CucumberJS entities like When, Then, etc...

## 2.2.0
- :rocket: added capability to pass memory path as string

## 2.1.2
- :beetle: improved ServiceHandler to use existing config instead of re-reading

## 2.1.1
- :pencil: bump memory version

## 2.1.0
- :rocket: added memory to world
- :rocket: updated `world.getValue` and `world.setValue` to use bound memory

## 2.0.2
- :beetle: fixed d.ts for new _MemoryValue_ and _Validation_ types

## 2.0.1
- :rocket: adjust dependencies

## 2.0.0
- :rocket: package renamed to @qavajs/core
- :rocket: added _value_ parameter type
- :rocket: added _validation_ parameter type
 
## 0.40.0
- :rocket: added config type definition
- :rocket: changed label to @qavajs/cli

## 0.39.0
- :rocket: added swc compiler

## 0.38.1
- :pencil: removed obsolete dependencies

## 0.38.0
- :rocket: added _setValue_ and _getValue_ world functions to interact with memory
- :x: - qavajs entities moved from global to cucumber world.
globals will be removed in future releases.

## 0.37.0
- :rocket: add logic to find default config

## 0.36.0
- :x: install script moved to separate module @qavajs/create
- :rocket: make run command optional

## 0.35.0
- :rocket: load support files programmatically

## 0.34.2
- :beetle: fixed array params provided from CLI
- :rocket: added CLI option descriptions and help

## 0.34.1
- :rocket: added _--no-error-exit_ flag to prevent emitting non-zero error code

## 0.34.0
- :rocket: scaffold readme.md file
- :rocket: updated default config to config.js
- :rocket: added timeout to before and after services
- :rocket: emit non-zero exit code in case of failures
  
## 0.33.0
- :rocket: throw an error in case if config/profile is not found
- :rocket: added lighthouse package

## 0.32.1
- introduced _IQavajsWorld_ describing added executeStep method 
- added support of data tables and multiline params to executeStep
Now it is possible to pass data table or multiline param as second parameter to executeStep method
```javascript
When('I do smth complex with data table', async function(dataTable) {
    await this.executeStep(`I type 'username' to 'Username Input'`, dataTable);
});
```

## 0.32.0
- added util function that allow to invoke step definitions from other step definitions
```javascript
When('I do smth complex', async function() {
    await this.executeStep(`I type 'username' to 'Username Input'`);
    await this.executeStep(`I type 'password' to 'Password Input'`);
    await this.executeStep(`I click 'Login Button'`);
});
```

## 0.31.0
- added shard related environment variables
- added logging of total test cases to be executed

## 0.30.2
- fixed issue with multiple instances of tags parameter

## 0.30.1
- fixed issue with mergable parameters

## 0.30.0
- added api test example
- removed xunit reporter from reporter lists
- removed testcafe from steps list
- added native support of ts

## 0.29.0
- upgrade shards chunking logic

## 0.28.0
- added shard parameter

## 0.27.0
- removed built-in computed in favor of using $js()
- made init hook named
- added memory logger

## 0.26.0
- added experimental testcafe binding
- added current scenario name as an environment variable CURRENT_SCENARIO_NAME

## 0.25.0
- added capability to pass multiple memory instances
- moved esm flag to tsconfig
- moved tests to vitest

## 0.0.24
- added util function to override step definition

## 0.0.23
- added capability to pass CLI params to child workers as environment variable
- added new modules to wizard

Breaking Change:
- removed wdio service adapter 
(adapter has been extracted to separate module https://www.npmjs.com/package/@qavajs/wdio-service-adapter)

## 0.0.22
- fixed support of multiple services

## 0.0.21
- added capability handle cucumber result in services

## 0.0.20
- fixed steps imports paths to import only main file
- added local step_definition folder to install script

## 0.0.19
- fixed install path for esm and typescript

## 0.0.18
- added question to select commonjs / esm modules / typescript
- added json computed

## 0.0.17
- esm support

## 0.0.15
- make qavajs cli compatible with cucumber cli

## 0.0.14
- added @qavajs/steps-sql
- added @qavajs/steps-accessibility

## 0.0.13
- added @qavajs/html-formatter
- added default out path for formatter packages

## 0.0.12
- added playwright option
- added computed to read environment variable
- added files option
- removed parallel option

## 0.0.11
- updated run logic to use runCucumber() API instead of deprecated CLI()
- added default logic if unrecognized command set
