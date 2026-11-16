// top-level await is only possible when config is loaded as ES module
const timeout: number = await Promise.resolve(30_000);

export default {
    defaultTimeout: timeout,
    kind: 'mts',
};

export const smoke = { kind: 'mts-smoke' };
