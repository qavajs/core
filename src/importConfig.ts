import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { UsageError } from './UsageError';

let loadTS = true;
async function importTS(configPath: string) {
    if (loadTS) {
        require('tsx/cjs/api').register();
        loadTS = false;
    }
    return require(configPath)
}

export async function importFile(path: string): Promise<any> {
    const fullPath = resolve(process.cwd(), path);
    if (!existsSync(fullPath)) throw new UsageError(`file '${path}' not found (resolved to ${fullPath})`);
    return fullPath.endsWith('.ts')
        ? await importTS(fullPath)
        : await import(pathToFileURL(fullPath).href);
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

const CONFIG_KEYS = ['paths', 'require', 'import', 'format', 'formatOptions', 'memory', 'defaultTimeout', 'parallel', 'tags', 'worldParameters'];

/**
 * Names of exported entries that look like profiles (plain objects)
 */
function listProfiles(configModule: any): string[] {
    const profiles = new Set<string>();
    for (const source of [configModule?.default, configModule]) {
        if (!isObject(source)) continue;
        // a plain config (not a map of profiles) - its nested objects are options, not profiles
        if (CONFIG_KEYS.some(key => key in source)) continue;
        for (const [key, value] of Object.entries(source)) {
            if (key === '__esModule' || (source === configModule && key === 'default')) continue;
            if (isObject(value) && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype) {
                profiles.add(key);
            }
        }
    }
    return [...profiles];
}

export async function importConfig(configPath: string, profile: string): Promise<any> {
    const configModule = await importFile(configPath);
    const profileObject = resolveProfile(configModule, profile);
    if (!profileObject) {
        const profiles = listProfiles(configModule);
        const available = profiles.length > 0 ? `. Available profiles: ${profiles.join(', ')}` : '';
        throw new UsageError(`profile '${profile}' is not defined in '${configPath}'${available}`);
    }
    return profileObject;
}
