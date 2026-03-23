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

function isObject(value: unknown): value is Record<string, any> {
    return typeof value === 'object' && value !== null;
}

function resolveProfile(configModule: any, profile: string): any {
    const defaultExport = configModule?.default;

    if (isObject(defaultExport) && profile in defaultExport) {
        return defaultExport[profile];
    }

    if (isObject(configModule) && profile in configModule) {
        return configModule[profile];
    }

    if (profile === 'default') {
        if (isObject(defaultExport) && !('default' in defaultExport)) {
            return defaultExport;
        }
        if (isObject(configModule) && !('default' in configModule)) {
            return configModule;
        }
    }

    return undefined;
}

export async function importConfig(configPath: string, profile: string): Promise<any> {
    const configModule = await importFile(configPath);
    const profileObject = resolveProfile(configModule, profile);
    if (!profileObject) throw new Error(`profile '${profile}' is not defined`);
    return profileObject;
}
