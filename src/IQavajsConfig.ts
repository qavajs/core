import { IConfiguration } from '@cucumber/cucumber/api';

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
}