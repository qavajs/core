import path from 'node:path';
import { IRunResult } from '@cucumber/cucumber/api';

export default class ServiceHandler {
    readonly services: Promise<Array<Service>>;
    constructor(private config: Config) {
        this.services = this.loadServices();
    }

    async loadServices() {
        if (!this.config.service) return [];
        const services = this.config.service.map(async svcDef => {
            const svc = await svcDef;
            if (typeof svc === 'string') {
                try {
                    return import(svc)
                } catch (e) {
                    return import(path.join(process.cwd(), svc))
                }
            }
            else if (Array.isArray(svc)) {
                const [svcPath, options] = svc;
                let service;
                try {
                    service = await import(svcPath)
                } catch (e) {
                    service = import(path.join(process.cwd(), svcPath))
                }
                service.options = options;
                return service
            }
            else {
                return svc
            }
        });
        return Promise.all(services);
    }

    async before() {
        for (const svc of await this.services) {
            if (svc.before) {
                await svc.before();
            }
        }
    }

    async after(result: IRunResult) {
        for (const svc of await this.services) {
            if (svc.after) {
                await svc.after(result);
            }
        }
    }
}
