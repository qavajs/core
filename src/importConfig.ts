import { join } from 'node:path';

let loadTS = true;
async function importTS(configPath: string) {
    if (loadTS) {
        require('ts-node').register();
        loadTS = false;
    }
    return require(configPath)
}
export default async function importConfig(configPath: string, profile: string): Promise<any> {
    const fullPath = join(process.cwd(), configPath);
    const importer: Promise<any> = fullPath.endsWith('.ts')
        ? importTS(fullPath)
        : import('file://' + fullPath);
    return importer.then(config => {
        const profileObject = config.default?.default
            ? config.default[profile]
            : config[profile]
        if (!profileObject) throw new Error(`profile '${profile}' is not defined`);
        return profileObject;
    });
}
