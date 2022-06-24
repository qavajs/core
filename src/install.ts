import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import yarnInstall from 'yarn-install';
import deps, {steps, format, services, ModuleDefinition} from './deps';

type Answers = {
    steps: Array<string>,
    formats: Array<string>,
    services: Array<string>
    parallel: number
}

const modules = (deps: Array<ModuleDefinition>) => deps.map(({module}) => module);
const packages = (moduleList: Array<string>, packageMap: Array<ModuleDefinition>): Array<string> => {
    return moduleList
        .map((module: string) => packageMap.find((p: ModuleDefinition) => p.module === module)?.packageName) as Array<string>
}

export default async function install(): Promise<void> {
    const answers = await inquirer.prompt([
        {
            type: 'checkbox',
            message: 'select step modules to install:',
            name: 'steps',
            choices: modules(steps)
        },
        {
            type: 'checkbox',
            message: 'select formatters (reporters) to install:',
            name: 'formats',
            choices: modules(format)
        },
        {
            type: 'checkbox',
            message: 'select services to install:',
            name: 'services',
            choices: modules(services)
        },
        {
            type: 'number',
            message: 'how many parallel instances to run?',
            name: 'parallel',
            default: 1
        }
    ]) as Answers;

    const stepsPackages: Array<string> = packages(answers.steps, steps);
    const formatPackages: Array<string> = packages(answers.formats, format);
    const servicePackages: Array<string> = packages(answers.services, services);

    const isPOIncluded: boolean = answers.steps.includes('wdio');

    const configTemplate: string = await fs.readFile(
        path.resolve(__dirname, '../templates/config.template'),
        'utf-8'
    );
    const configLoaderPackage = '@qavajs/steps-config-loader';

    let config: string = configTemplate
        .replace('<modules>', JSON.stringify([configLoaderPackage, ...stepsPackages].map(p => 'node_modules/' + p)))
        .replace('<format>', JSON.stringify(formatPackages))
        .replace('<service>', JSON.stringify(servicePackages))
        .replace('<parallel>', answers.parallel.toString())

    if (isPOIncluded) {
        const pageObjectSnippet =
    `
        pageObject: new App(),
        browser: {
            capabilities: {
                browserName: 'chrome'
            }
        },
    `
        config = config
            .replace('<importPageObject>', 'const App = require("./page_object");')
            .replace('<configPageObject>', pageObjectSnippet);
    }

    config = config
        .replace(/<.+?>/g, '')
        .replace(/\n\s+\n/g, '\n');

    await fs.writeFile('config.js', config, 'utf-8');
    await fs.ensureDir('./features');
    await fs.ensureDir('./memory/');
    await fs.ensureDir('./report/');

    const memoryTemplate: string = await fs.readFile(
        path.resolve(__dirname, '../templates/memory.template'),
        'utf-8'
    );

    await fs.writeFile('./memory/index.js', memoryTemplate, 'utf-8');

    if (isPOIncluded) {
        await fs.ensureDir('./page_object');
        const poTemplate: string = await fs.readFile(
            path.resolve(__dirname, '../templates/po.template'),
            'utf-8'
        );
        await fs.writeFile('./page_object/index.js', poTemplate, 'utf-8');
    }

    const modulesToInstall = [...deps, ...stepsPackages, ...formatPackages, ...servicePackages];
    console.log('installing modules...');
    console.log(modulesToInstall);

    yarnInstall({
        deps: modulesToInstall,
        cwd: process.cwd(),
        respectNpm5: true
    });
}
