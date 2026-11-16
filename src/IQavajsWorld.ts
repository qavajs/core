import type { DataTable, IWorld } from '@cucumber/cucumber';
import type { Memory } from '@qavajs/memory';

/**
 * Validation function
 * @example
 * expect(actualValue, expectedValue);
 * expect.poll(actualValue, expectedValue)
 */
export interface Validation {
    /**
     * Perform validation
     * @param {any} actualResult - actual result
     * @param {any} expectedResult - expected result
     */
    (actualResult: any, expectedResult: any): void;
    /**
     * @property
     * original expression passed to memory value
     */
    type: string;
    /**
     * Perform polling validation
     * @param {any} actualResult - actual result
     * @param {any} expectedResult - expected result
     * @param {number} options.timeout - timeout to poll
     * @param {number} options.interval - interval to poll
     */
    poll: (actualResult: any, expectedResult: any, options?: { timeout?: number, interval?: number }) => Promise<unknown>;
}

export interface IQavajsWorld extends IWorld {
    /**
     * Get value from memory
     * @param {any} expression - expression to parse
     */
    getValue(expression: any): any;

    /**
     * Save value to memory
     * @param {string} key - key to store
     * @param {any} value - value to store
     */
    setValue(key: string, value: any): void;

    /**
     * Execute existing step definition
     * @param {string} step - cucumber expression to execute
     * @param {DataTable | string} extraParam - extra data table or multiline string
     * @example
     * this.executeStep(`I click 'Login Button'`);
     */
    executeStep(step: string, extraParam?: DataTable | string): Promise<void>;

    /**
     * Execute test by provided path and test title
     * @param {string} path - feature file path
     * @param {string} title - test title
     * @example
     * this.executeTest('features/Login.feature', 'Login');
     */
    executeTest(path: string, title: string): Promise<void>;

    /**
     * Return validation function by provided type
     * @param {string} type - type of validation
     */
    validation(type: string): Validation;

    /**
     * memory instance
     */
    memory: Memory;

    /**
     * qavajs config
     */
    config: any;
}
