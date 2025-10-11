import { join } from 'node:path';

let loadTS = true;
async function importTS(configPath: string) {
    if (loadTS) {
        require('ts-node').register();
        loadTS = false;
    }
    return require(configPath)
}

export async function importFile(path: string): Promise<any> {
    const fullPath = join(process.cwd(), path);
    return fullPath.endsWith('.ts')
        ? await importTS(fullPath)
        : await import('file://' + fullPath);
}

export async function importMemory(path: string): Promise<any> {
    const memoryInstance = await importFile(path);
    return memoryInstance.default ?? memoryInstance;
}

export async function importConfig(configPath: string, profile: string): Promise<any> {
    const config = await importFile(configPath);
    const profileObject = config.default?.default
        ? config.default[profile]
        : config[profile];
    if (!profileObject) throw new Error(`profile '${profile}' is not defined`);
    return profileObject;
}
