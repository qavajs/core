import { Formatter, IFormatterOptions } from '@cucumber/cucumber';

/**
 * Formatter used by ui mode: forwards every cucumber message to the ui server over IPC
 */
export default class UiFormatter extends Formatter {
    static readonly documentation = 'qavajs ui mode formatter (internal)';

    constructor(options: IFormatterOptions) {
        super(options);
        options.eventBroadcaster.on('envelope', (envelope: unknown) => {
            process.send?.({ type: 'envelope', envelope });
        });
    }
}
