import { BeforeAll, AfterAll } from '@cucumber/cucumber';

interface ExecutionHook {
    (): any;
    isTestExecutionHook: boolean;
}

const isCoordinator = process.env.QAVAJS_COORDINATOR === '1';

export function BeforeExecution(fn: ExecutionHook) {
    if (!isCoordinator) return;
    fn.isTestExecutionHook = true;
    BeforeAll(fn as any);
}

export function AfterExecution(fn: ExecutionHook) {
    if (!isCoordinator) return;
    fn.isTestExecutionHook = true;
    AfterAll(fn as any);
}