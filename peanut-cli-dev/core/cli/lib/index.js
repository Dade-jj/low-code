'use strict'

module.exports = core

const path = require('path')
const pkg = require('../package.json')
const log = require('@peanut-cli-dev/log')
const exec = require('@peanut-cli-dev/exec')
const constant = require('./const')
const semver = require('semver')
const colors = require('colors/safe')
const pathExists = require('path-exists').sync
const userHome = require('user-home')
const { Command }  = require('commander')

const program = new Command()

let args,config
async function core () {
    try {
        await prepare()
        registerCommand()
    } catch (error) {
        log.error(error.message)
        if (program.opts().debug) {
            console.log(e)
        }
    }
}

async function prepare(){
    checkPkgVersion()
        checkNodeVersion()   
        checkRoot()
        checkUserHome()
        checkEnv()
        await checkGlobalUpdate()
}

function registerCommand() {
    program
        .name(Object.keys(pkg.bin)[0])
        .usage('<command> [options]')
        .version(pkg.version)
        .option('-d, --debug', '是否开启调试模式', false)
        .option('-tp, --targetPath <targetPath>', '是否指定本地调试文件路径', '')

    program
        .command('init [projectName]')
        .option('-f, --force', '是否强制初始化项目')
        .action(exec)

    program.on('option:targetPath', function() {
        process.env.CLI_TARGET_PATH = program.opts().targetPath
    })
     
    program.on('option:debug', function() {
        if (program.opts().debug) {
            process.env.LOG_LEVEL = 'verbose'
        } else {
            process.env.LOG_LEVEL = 'info'
        }
        log.level = process.env.LOG_LEVEL
        log.verbose('test')
    })

    program.on('command:*', function(obj) {
        const availableCommands = program.commands.map(cmd => cmd.name())
        console.log(colors.red('未知的命令：' + obj[0])) 
        if (availableCommands.length > 0) {
            console.log(colors.red('可知的命令：' + availableCommands.join(',')))
        }
    })
    program.parse(process.argv)
    if (program.args && program.args.length < 1) {
        program.outputHelp()
    } 

}

async function checkGlobalUpdate() {
    // 1.获取当前版本号和模块名
    const currentVersion = pkg.version
    const npmName = pkg.name
    // 2.调用npm API,获取所有版本号
    const { getNpmSemverVersions } = require('@peanut-cli-dev/get-npm-info')
    const lastVeriosn = await getNpmSemverVersions(currentVersion, npmName)
    if (lastVeriosn && semver.gt(lastVeriosn, currentVersion)) {
        log.warn(colors.yellow(`请手动更新${npmName},当前版本：${currentVersion}, 最新版本：${lastVeriosn}
        更新命令：npm install -g ${npmName}`))
    }
    // 3.提取所有版本号,比对哪些版本号是大于当前版本号
    // 4.获取最新版本号,提示用户更新到哪些版本
}
function checkEnv() {
    const dotenv = require('dotenv')
    const dotenvPath = path.resolve(userHome, '.env')
    dotenv.config({
        path: dotenvPath
    })
    createDefaultConfig()
}

function createDefaultConfig() {
    const cliConfig = {
        home: userHome
    }
    if (process.env.CLI_HOME) {
        cliConfig['cliHome'] = path.join(userHome, process.env.CLI_HOME)
    } else {
        cliConfig['cliHome'] = path.join(userHome, constant.DEFAULT_CLI_HOME)
    }
    process.env.CLI_HOME_PATH = cliConfig.cliHome
    return cliConfig
}

function checkInputArgs() {
    const minimist = require('minimist')
    args = minimist(process.argv.slice(2))
    checkArgs()
}

function checkArgs() {
    if (args.debug) {
        process.env.LOG_LEVEL = 'verbose'
    } else {
        process.env.LOG_LEVEL = 'info'  
    }
    log.level = process.env.LOG_LEVEL 
}

function checkUserHome() {
    if (!userHome || !pathExists(userHome)) {
        throw new Error(colors.red('当前登录用户主目录不存在'))
    }
}

function checkRoot() {
    const rootCheck = require('root-check')
    rootCheck()
}

function checkPkgVersion() {
    log.info('cli', pkg.version)
}

function checkNodeVersion() {
    const currentVersion = process.version
    const lowestVersion = constant.LOWEST_NODE_VERSION
    if (!semver.gte(currentVersion, lowestVersion)) {
        throw new Error(colors.red(`peanut-cli 需要安装v${lowestVersion} 以上版本的Node.js`))
    }
}