'use strict';
const axios = require('axios')
const semver = require('semver')
const urlJoin = require('url-join')

function getNpmInfo(npmName, registry) {
    if (!npmName) return null
    registry = registry || getDefaultRegistry()
    const npmInfoUrl = urlJoin(registry, npmName)
    return axios.get(npmInfoUrl).then(response => {
        if (response.status === 200) {
            return response.data 
        } 
        return null
    }).catch(err => {
        console.log('err', err)
        return Promise.reject(err)
    })
}


async function getNpmVersion(npmName, registry) {
    const data = await getNpmInfo(npmName, registry)
    if (data) {
        return Object.keys(data.versions)
    } else {
        return []
    }
}

function getDefaultRegistry(isOriginal = false) {
    return isOriginal ? 'https://registry.npmjs.org' : 'https://registry.npm.taobao.org'
    // return 'https://registry.npmjs.org'
}

function getSemverVersions(baseVersion, versions) {
    versions = versions.filter((version) => {
        semver.satisfies(version, `^${baseVersion}`)
    }).sort((a,b) => {
        return semver.gt(b,a)
    })
    return versions
}

async function getNpmSemverVersions(baseVersion, npmName, registry) {
    const versions = await getNpmVersion(npmName, registry)
    const newVersions = getSemverVersions(baseVersion, versions) 
    if (newVersions && newVersions.length > 0) {
        return newVersions[0]
    }
    return null
}

async function getNpmLatestVersion(npmName, registry) {
    let versions = await getNpmVersion(npmName, registry)
    console.log('versions', versions)
    if (versions) {
        versions = versions.sort((a, b) => semver.gt(a, b))[0]
    }
    return null
}

module.exports = {
    getNpmInfo,
    getNpmSemverVersions,
    getDefaultRegistry,
    getNpmLatestVersion
}
