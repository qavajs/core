import { DataTable, IWorld } from '@cucumber/cucumber';
import { Memory } from '@qavajs/memory';

export interface Validation {
    (AR: any, ER: any): void;
    type: string;
    poll: (AR: any, ER: any, options?: {timeout?: number, interval?: number}) => Promise<unknown>
}

export interface IQavajsWorld extends IWorld {
    getValue(expression: string): any;
    setValue(key: string, value: any): void;
    executeStep(step: string, extraParam?: DataTable | string): Promise<void>;
    validation(type: string): Validation;
    memory: Memory;
    config: any;
}
