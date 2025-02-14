export interface Config {
    vanityURLs?: string[];
}
export declare function readConfig(configPath: string): Promise<Config>;
declare const _default: {
    readConfig: typeof readConfig;
};
export default _default;
