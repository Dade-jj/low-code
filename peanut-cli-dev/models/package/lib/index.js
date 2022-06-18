'use strict';

const { isObject } = require('@peanut-cli-dev/utils')
const pkgDir = require('pkg-dir').sync
const path = require('path')
const pathExists = require('path-exists').sync
const formatPath = require('@peanut-cli-dev/format-path')
const npminstall = require('npminstall')
const fsExtra = require('fs-extra')
const { getDefaultRegistry, getNpmLatestVersion } = require('@peanut-cli-dev/get-npm-info')

class Package {
    constructor(options) {
        if (!options) {
            throw new Error('Package类的options参数不能为空')
        }
        if (!isObject(options)) {
            throw new Error('Package类的options参数必须是对象')
        }
        // Package的路径
        this.targetPath = options.targetPath

        // Package的存储路径
        this.storePath = options.targetPath

        // 缓存的路径
        this.storeDir = options.storeDir

        //package的name
        this.packageName = options.packageName
        // package的缓存
        this.packageVersion = options.packageVersion
        // package的缓存目录前缀
        this.cacheFilePathPrefix = this.packageName.replace('/', '_')
    }

    async prepare() {
        if (this.storeDir && !pathExists(this.storeDir)) {
            fsExtra.mkdirp(this.storeDir)
        }
        if (this.packageVersion === 'latest') {
            this.packageVersion = await getNpmLatestVersion(this.packageName, 'https://registry.npmjs.org')
        }
    }

    get cacheFilePath() {
        return path.resolve(this.storeDir, `_${this.cacheFilePathPrefix}@${this.packageVersion}
        @${this.packageName}`)
    }

    getSpecificCacheFilePath(packageVersion) {
        return path.resolve(this.storeDir, `_${this.cacheFilePathPrefix}@${packageVersion}
        @${this.packageName}`)
    }

    async exists() {
        if (this.storeDir) {
            await this.prepare()
            return pathExists(this.cacheFilePath)
        } else {
            return pathExists(this.targetPath)
        }
    }

    install() {
        return npminstall({
            root: this.targetPath,
            storeDir: this.storeDir,
            registry: getDefaultRegistry(true),
            pkgs: [
                { name: this.packageName, version: this.packageVersion }
            ]
        })
    }

    async update() {
        await this.prepare()
        // 1.获取最新的npm版本号
        const latestPackageVersion = await getNpmLatestVersion(this.packageName, 'https://registry.npmjs.org')
        // 2.查询最新版本号对应的路径是否存在
        const latestFilePath = this.getSpecificCacheFilePath(latestPackageVersion)
        // 3.如果不存在,则直接安装最新版本
        if (!pathExists(latestFilePath)) {
            await npminstall({
                root: this.targetPath,
                storeDir: this.storeDir,
                registry: getDefaultRegistry(true),
                pkgs: [
                    { name: this.packageName, version: latestPackageVersion }
                ]
            })
            this.packageVersion = latestPackageVersion
        }
        return latestFilePath
    }

    getRootFilePath() {

        function _getRootFile(targetPath) {
            // 1.读取package.json
            const dir = pkgDir(targetPath)
            if (dir) {
                // 2.读取package.json文件
                const pkgFile = require(path.resolve(dir, 'package.json'))
                // 3.寻找main/lib
                if (pkgFile && pkgFile.main) {
                    return formatPath(path.resolve(dir, pkgFile.main))
                }
            }
            return null
        }

        if (this.storeDir) {
            return _getRootFile(this.cacheFilePath)
        } else {
            return _getRootFile(this.targetPath)
        }
        
    }
}


module.exports = Package;
