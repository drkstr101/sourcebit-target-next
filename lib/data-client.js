const fse = require('fs-extra');
const _ = require('lodash');
const { DEFAULT_FILE_CACHE_PATH } = require('./consts');

class SourcebitDataClient {
    constructor() {
        // Every time getStaticPaths is called, the page re-imports all required
        // modules causing this singleton to be reconstructed loosing any in
        // memory cache.
        // https://github.com/zeit/next.js/issues/10933
    }

    async getData(cacheFile) {
        // For now, we are reading the changes from filesystem until re-import
        // of this module will be fixed: https://github.com/zeit/next.js/issues/10933
        // TODO: DEFAULT_FILE_CACHE_PATH won't work if default cache file path
        //   was changed, but also can't access the specified path because
        //   nextjs re-imports the whole module when this method is called
        const cacheFilePath = cacheFile === undefined? DEFAULT_FILE_CACHE_PATH : cacheFile;
        const cacheFileExists = new Promise((resolve, reject) => {
            const retryDelay = 500;
            const maxNumOfRetries = 10;
            let numOfRetries = 0;
            const checkPathExists = async () => {
                const pathExists = await fse.pathExists(cacheFilePath);
                if (!pathExists && numOfRetries < maxNumOfRetries) {
                    numOfRetries += 1;
                    console.log(
                        `error in sourcebitDataClient.getData(), cache file '${cacheFilePath}' was not found, waiting ${retryDelay}ms and retry #${numOfRetries}`
                    );
                    setTimeout(checkPathExists, retryDelay);
                } else if (!pathExists) {
                    reject(
                        new Error(
                            `sourcebitDataClient of the sourcebit-target-next plugin did not find '${cacheFilePath}' file. Please check that other Sourcebit plugins are executed successfully.`
                        )
                    );
                } else {
                    resolve();
                }
            };
            checkPathExists();
        });

        await cacheFileExists;

        return fse.readJson(cacheFilePath);
    }

    async getStaticPaths(cacheFile) {
        const data = await this.getData(cacheFile);
        let paths = _.map(data.pages, (page) => page.path).filter(Boolean);
        if (process.env.NODE_ENV === 'development') {
            paths = paths.concat(_.map(paths, (pagePath) => pagePath + (pagePath !== '/' ? '/' : '')));
        }
        return paths;
    }

    async getStaticPropsForPageAtPath(pagePath, cacheFile) {
        const data = await this.getData(cacheFile);
        return this.getPropsFromCMSDataForPagePath(data, pagePath);
    }

    getPropsFromCMSDataForPagePath(data, pagePath) {
        if (_.isArray(pagePath)) {
            pagePath = pagePath.join('/');
        }
        pagePath = '/' + _.trim(pagePath, '/');
        const page = _.find(data.pages, { path: pagePath });
        return _.assign(page, data.props);
    }
}

module.exports.SourcebitDataClient = SourcebitDataClient;
