[![npm version](https://badge.fury.io/js/@qavajs%2Fcore.svg)](https://badge.fury.io/js/@qavajs%2Fcore)

## @qavajs/core

`@qavajs/core` is the core test runner module of the [qavajs](https://github.com/qavajs) automation framework.
It extends [CucumberJS](https://github.com/cucumber/cucumber-js) with memory management, validation utilities,
fixtures, templates, services, and test composition — all with full ESM, CJS, and TypeScript support.

**Requirements**: Node.js >= 20

---

## Table of Contents

- [Installation](#installation)
- [Running Tests](#running-tests)
  - [CLI Options](#cli-options)
- [Configuration](#configuration)
- [World Extensions](#world-extensions)
- [Memory Value Parameter Type](#memory-value-parameter-type)
- [Validation Parameter Type](#validation-parameter-type)
- [Soft Validation](#soft-validation)
- [Execute Steps from Other Steps](#execute-steps-from-other-steps)
- [Execute Other Tests](#execute-other-tests)
- [Override Step Definition](#override-step-definition)
- [Fixture](#fixture)
- [Template](#template)
- [Test Execution Hooks](#test-execution-hooks)
- [Service](#service)
- [Override Memory Values via CLI](#override-memory-values-via-cli)
- [Pass CLI Params to Workers](#pass-cli-params-to-workers)

---

## Installation

```bash
npm install @qavajs/core
```

---

## Running Tests

```bash
npx qavajs run --config <config> --profile <profile>
```

`cucumber-js` is also available as an alias:

```bash
npx cucumber-js run --config <config>
```

### CLI Options

| Flag | Type | Description |
|------|------|-------------|
| `--config` | string | Config file path |
| `--profile` | string | Profile name to run |
| `--paths` | string[] | Paths to feature files |
| `--tags`, `-t` | string[] | Tag expression filter (multiple flags are ANDed) |
| `--format`, `-f` | string[] | Formatter name/path and optional output file |
| `--format-options` | string | JSON options for formatters |
| `--import`, `-i` | string[] | Support code paths (ESM) |
| `--require`, `-r` | string[] | Support code paths (CJS) |
| `--require-module` | string[] | Transpilation modules to load via `require()` |
| `--name` | string[] | Scenario name regex filters |
| `--order` | string | Run order (`defined` or `random`) |
| `--parallel` | number | Number of worker processes |
| `--retry` | number | Retry failing tests N times |
| `--retry-tag-filter` | string[] | Tag expression for retryable scenarios |
| `--dry-run`, `-d` | boolean | Prepare run without executing |
| `--backtrace`, `-b` | boolean | Show full error backtraces |
| `--fail-fast` | boolean | Stop on first failure |
| `--force-exit` | boolean | Call `process.exit()` after run |
| `--strict` | boolean | Fail on pending steps |
| `--shard` | string | Shard tests (`x/y`) |
| `--world-parameters` | string | JSON parameters passed to World |
| `--memory-values` | string | JSON values to override in memory |
| `--no-error-exit` | boolean | Suppress non-zero exit code on test failure |

---

## Configuration

Config files can be written in JS, CJS, TS, or ESM format.

```typescript
// config.ts
export default {
    paths: ['features/**/*.feature'],
    require: ['step_definitions/**/*.ts'],
    memory: new Memory(),
    defaultTimeout: 30_000,
}
```

| Property         | Type     | Default    | Description                                          |
|------------------|----------|------------|------------------------------------------------------|
| `memory`         | object   | `{}`       | Memory instance for storing/retrieving test values   |
| `defaultTimeout` | number   | `10_000`   | Default step timeout in milliseconds                 |
| ~~`service`~~    | array    | `[]`       | **Deprecated.** Use `BeforeExecution`/`AfterExecution` instead |
| ~~`serviceTimeout`~~ | number | `60_000` | **Deprecated.** Use `BeforeExecution`/`AfterExecution` instead |

All standard [CucumberJS configuration options](https://github.com/cucumber/cucumber-js/blob/main/docs/configuration.md) are also supported.

---

## World Extensions

`@qavajs/core` extends the CucumberJS `World` with additional properties and methods:

| Entity        | Type     | Description                                         | Example                                                              |
|---------------|----------|-----------------------------------------------------|----------------------------------------------------------------------|
| `config`      | object   | Loaded configuration object                         | `this.config.parallel`                                               |
| `memory`      | object   | Memory instance                                     | `this.memory.$key`                                                   |
| `executeStep` | function | Programmatically execute a step definition          | `await this.executeStep("I type 'user' to 'Username Input'");`       |
| `executeTest` | function | Execute another test scenario by path and title     | `await this.executeTest('feature/Login.feature', 'Login scenario');` |
| `setValue`    | function | Set a value in memory                               | `this.setValue('key', 'value');`                                     |
| `getValue`    | function | Get a memory value or resolve an expression         | `await this.getValue('$key');`                                       |
| `validation`  | function | Get a validation function by type                   | `const fn = await this.validation('to equal');`                      |

TypeScript users can import the `IQavajsWorld` interface:

```typescript
import { IQavajsWorld } from '@qavajs/core';

When('I do something', async function(this: IQavajsWorld) {
    const value = await this.getValue('$myKey');
});
```

---

## Memory Value Parameter Type

The `{value}` parameter type provides access to the memory layer. It resolves a memory expression at runtime, and also exposes a `set` method to write values back.

```javascript
When('I read memory {value}', async function(memoryValue) {
    expect(memoryValue.value()).toEqual('expectedValue');
});

When('I set memory {value} as {string}', async function(memoryKey, value) {
    memoryKey.set(value);
});
```

---

## Validation Parameter Type

The `{validation}` parameter type provides assertion functions for comparing two values. It supports both instant and polling-based verification.

```javascript
When('I expect {string} {validation} {string}', async function(actual, validate, expected) {
    validate(actual, expected);
});
```

**Polling validation** retries until the condition is met or a timeout is reached:

```javascript
When('I poll-expect {string} {validation} {string}', async function(actual, validate, expected) {
    await validate.poll(
        () => actual,
        expected,
        { timeout: 5000, interval: 500 }
    );
});
```

---

## Soft Validation

Prefix any validation step with `softly` to allow the scenario to continue even when an assertion fails.
All soft failures are collected and reported at the end of the scenario.

```gherkin
Feature: Soft assertions example

  Scenario: verify soft assert
    Then I expect '2' to softly equal '1'  # fails, but execution continues
    And  I expect '1' to softly equal '1'  # passes
    And  I expect '2' to softly equal '1'  # fails
    And  I expect '1' to softly equal '1'  # passes — all failures reported at end
```

---

## Execute Steps from Other Steps

Use `this.executeStep` to compose complex step logic from existing steps:

```typescript
When('I log in as {string}', async function(username: string) {
    await this.executeStep(`I type '${username}' to 'Username Input'`);
    await this.executeStep(`I type 'secret' to 'Password Input'`);
    await this.executeStep(`I click 'Login Button'`);
    await this.executeStep(`I fill following fields`, new DataTable([
        ['Order', '123'],
        ['Delivery Location', 'New York']
    ]));
});
```

---

## Execute Other Tests

Use `this.executeTest` to call another test scenario from within a scenario:

```typescript
When('I complete checkout', async function() {
    await this.executeTest('features/Login.feature', 'User logs in');
    await this.executeTest('features/Cart.feature', 'User adds item to cart');
});
```

---

## Override Step Definition

`Override` replaces an existing step implementation without causing an ambiguous step error.
Useful when extending a shared library's steps with project-specific behavior.

```typescript
import { Override } from '@qavajs/core';

// original step from a shared library
When('I do test', async function() {});

// replace it without conflicts
Override('I do test', async function() {
    console.log('overridden implementation');
});
```

---

## Fixture

`Fixture` prepares the test environment for scenarios with a specific tag. An optional return value is treated as a teardown function executed after the scenario.

```typescript
import { Fixture } from '@qavajs/core';

Fixture({ name: 'pdp', tags: '@pdp' }, async function() {
    await this.playwright.page.goto('https://my-site/pdp');

    // teardown: runs after the scenario
    return async function() {
        await this.playwright.page.request.get('/cleanCart');
    };
});
```

```gherkin
Feature: Product page

  @pdp
  Scenario: Add item to cart
    When I click 'qavajs T-shirt'
    And  I click 'cart icon'
    Then I expect 'qavajs T-shirt cart item' to be visible
```

---

## Template

`Template` lets you define a step by composing existing Gherkin steps, keeping step definitions DRY.

```typescript
import { When, Template } from '@qavajs/core';

When('I click {string} and verify {string}', Template((locator, expected) => `
    I click '${locator}'
    I expect '${locator} > Value' to equal '${expected}'
`));
```

---

## Test Execution Hooks

`BeforeExecution` and `AfterExecution` run once before or after the entire test run — useful for
starting/stopping infrastructure that must outlive individual scenarios.

```typescript
import { BeforeExecution, AfterExecution } from '@qavajs/core';
import { Server } from './server';

const server = new Server();

BeforeExecution(async function() {
    await server.start();
});

AfterExecution(async function() {
    await server.stop();
});
```

---

## Service

> **Deprecated** — `service` and `serviceTimeout` are deprecated and will be removed in a future version.
> Use [`BeforeExecution`/`AfterExecution` hooks](#test-execution-hooks) instead.

Services provide `before`/`after` lifecycle hooks for the full test run. They have access to a typed
`options` context and receive the run result in `after`.

```typescript
import externalService from './externalService';

export default {
    service: [
        {
            options: { baseUrl: 'https://api.example.com' },
            async before() {
                console.log('Starting with', this.options.baseUrl);
            },
            async after(result) {
                if (!result.success) process.exitCode = 1;
            }
        },
        {
            options: { data: 42 },
            ...externalService
        }
    ]
}
```

Services have a **default timeout of 60 seconds**. Override it with `serviceTimeout` (in milliseconds):

```typescript
export default {
    serviceTimeout: 120_000  // 2 minutes
}
```

---

## Override Memory Values via CLI

Pass a JSON object via `--memory-values` to override specific memory keys at runtime — useful for
running the same suite against different environments.

```bash
npx qavajs run --config config.ts --memory-values '{"url": "https://staging.example.com"}'
```

This overrides `$url` in the memory layer for the entire test run.

---

## Pass CLI Params to Workers

All CLI arguments passed to `qavajs` are forwarded to child workers via the `CLI_ARGV` environment variable,
allowing step definitions and config files running in worker processes to read them.