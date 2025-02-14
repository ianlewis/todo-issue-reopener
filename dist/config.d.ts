/**
 * Config represents the parsed config file.
 */
export interface Config {
    /**
     * vanityURLs is a list of regex strings to match against vanity issue URLs.
     */
    vanityURLs?: string[];
}
/**
 * readConfig is an async function that reads the config.yml file at the given
 * path and return the parsed Config object.
 * @param {string} configPath The path to the configuration file.
 * @returns {Promise<Config>} The parsed config object.
 */
export declare function readConfig(configPath: string): Promise<Config>;
