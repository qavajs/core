import { BeforeAll, AfterAll } from '@cucumber/cucumber';

interface ExecutionHook {
    (): any;
    isTestExecutionHook: boolean;
}

export function BeforeExecution(fn: ExecutionHook) {
    if (process.env.QAVAJS_COORDINATOR !== '1') return;
    fn.isTestExecutionHook = true;
    BeforeAll(fn as any);
}

export function AfterExecution(fn: ExecutionHook) {
    if (process.env.QAVAJS_COORDINATOR !== '1') return;
    fn.isTestExecutionHook = true;
    AfterAll(fn as any);
}