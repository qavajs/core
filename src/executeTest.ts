import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AstBuilder, compile, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import type { IQavajsWorld } from '../index';
import { DataTable } from '@cucumber/cucumber';

const uuidFn = () => randomUUID();
const builder = new AstBuilder(uuidFn);
const matcher = new GherkinClassicTokenMatcher();
const parser = new Parser(builder, matcher)

export async function executeTest(this: IQavajsWorld, path: string, title: string) {
    const filePath = resolve(path);
    const fileContent = await readFile(filePath, 'utf8');
    const gherkinDocument = parser.parse(fileContent);
    const tests = compile(gherkinDocument, filePath, uuidFn);
    const test = tests.find(test => test.name === title);
    if (!test) {
        throw new Error(`Scenario '${title}' not found in ${filePath}`);
    }
    for (const step of test.steps) {
        const argument = step.argument
            ? step.argument.dataTable
                ? new DataTable(step.argument.dataTable)
                : step.argument.docString?.content
            : undefined;
        await this.executeStep(step.text, argument);
    }
}