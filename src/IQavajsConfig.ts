import { IConfiguration, IRunResult } from '@cucumber/cucumber/api';

export type ServiceObject = {
    before?: () => void | Promise<void>;
    after?: (result: IRunResult) => void | Promise<void>;
};

export type ServiceDefinition = string | [string, object] | ServiceObject;

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
     * @deprecated Use BeforeExecution/AfterExecution hooks instead
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
    service?: Array<ServiceDefinition>,
    /**
     * Qavajs service timeout
     *
     * default: 60_000
     * @deprecated Use BeforeExecution/AfterExecution hooks instead
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