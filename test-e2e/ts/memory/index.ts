export class Constants {
    customValue = 'ts';
    getterSetter = {
        _value: 42,
        get value() { return this._value; },
        set value(v1) { this._value = v1; },
    }
}

export default {
    customValue: 'ts'
}
