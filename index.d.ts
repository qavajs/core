export * from '@cucumber/cucumber';
import { DataTable, IWorld, When } from '@cucumber/cucumber';
import { IConfiguration, IRunResult } from '@cucumber/cucumber/api';
export const Override: typeof When;
export { Fixture } from 'src/Fixture';
export { Template } from 'src/Template';
export { BeforeExecution, AfterExecution } from 'src/executionHooks.js';

/**
 * Validation function
 * @example
 * expect(actualValue, expectedValue);
 * expect.poll(actualValue, expectedValue)
 */
export interface Validation {
    /**
     * Perform polling validation
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
    poll: (AR: any, ER: any, options?: {timeout?: number, interval?: number}) => Promise<unknown>
}

/**
 * Memory value
 * @example
 * memoryValue.value();
 * memoryValue.set('some data')
 */
export interface MemoryValue {
    /**
     * @property
     * original expression passed to memory value
     */
    expression: string;
    /**
     * Return resolved value
     * @example
     * url.value()
     * @return Promise<any>
     */
    value(): any;

    /**
     * Set value to memory with provided key
     * @param {any} value - value to set
     * @example
     * url.set('https://qavajs.github.io/')
     */
    set(value: any): void;
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
     */
    executeStep(step: string, extraParam?: DataTable | string): Promise<void>;

    /**
     * Return validation function by provided type
     * @param {string} type - type of validation
     */
    validation(type: string): Validation;

    /**
     * qavajs config
     */
    config: any;
}

export interface IQavajsConfig extends Partial<IConfiguration> {
    /**
     * instance of memory object
     *
     * default: {}
     * @example
     * import Memory from './memory/Memory';
     *
     * export default {
     *     memory: new Memory()
     * }
     */
    memory?: Object,
    /**
     * Cucumber steps timeout
     *
     * default: 10_000
     * @example
     * export default {
     *     defaultTimeout: 20_000
     * }
     */
    defaultTimeout?: number,
    /**
     * Qavajs services
     *
     * default: []
     * @example
     * export default {
     *     service: [{
     *         before() {
     *             console.log('service started');
     *         },
     *         after(result: IRunResult) {
     *             console.log(result.success);
     *         }
     *     }]
     * }
     */
    service?: Array<{ before?: () => void, after: (result: IRunResult) => void }>,
    /**
     * Qavajs service timeout
     *
     * default: []
     * @example
     * export default {
     *     service: [{
     *         before() {
     *             console.log('service started');
     *         },
     *         after(result: IRunResult) {
     *             console.log(result.success);
     *         }
     *     }],
     *     serviceTimeout: 30_000
     * }
     */
    serviceTimeout?: number
}