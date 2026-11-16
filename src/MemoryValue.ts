import type { IQavajsWorld } from './IQavajsWorld';

/**
 * Memory value
 * @example
 * memoryValue.value();
 * memoryValue.set('some data')
 */
export class MemoryValue {
    /**
     * @param world - world used to resolve the expression
     * @param expression - original expression passed to memory value
     */
    constructor(public world: IQavajsWorld, public expression: string) {}

    /**
     * Return resolved value
     * @example
     * url.value()
     * @return any
     */
    value(): any { return this.world.getValue(this.expression) }

    /**
     * Set value to memory with provided key
     * @param value any - value to set
     * @example
     * url.set('https://qavajs.github.io/')
     */
    set(value: any): void { this.world.setValue(this.expression, value); }
}
