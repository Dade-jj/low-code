'use strict';

const Package = require('@peanut-cli-dev/package')
const log = require('@peanut-cli-dev/log')
const path = require('path')
const cp = require('child_process')

const SETTINGS = {
    init: '@peanut-cli-dev/init'
}

const CACHE_DIR = 'dependencies'
async function exec() {
    let targetPath = process.env.CLI_TARGET_PATH
    const homePath = process.env.CLI_HOME_PATH
    let storeDir = '',pkg
    log.verbose('targetPath', targetPath)
    log.verbose('homePath', homePath)
    const packageVersion = 'latest'
    const cmdObj = arguments[arguments.length - 1]
    // console.log(cmdObj)
    const cmdName = cmdObj.name()
    const packageName = SETTINGS[cmdName]
    if (!targetPath) {
        targetPath = path.resolve(homePath, CACHE_DIR)
        storeDir = path.resolve(targetPath, 'node_modules')
        log.verbose('targetPath', targetPath)
        log.verbose('targetPath', storeDir)
        
        pkg = new Package({ 
            targetPath, 
            packageName, 
            packageVersion,
            storeDir
        })
        if (await pkg.exists()) {
            // 更新pakcage
            await pkg.update()
        } else {
            // 安装package
            await pkg.install()
        }
    } else {
        pkg = new Package({ 
            targetPath, 
            packageName, 
            packageVersion,
        })
    }
    const rootFile = pkg.getRootFilePath()
    console.log(rootFile)
    if (rootFile) {
        try {
            // 在当前进程中调用
            // require(rootFile).apply(null, Array.from(arguments))
            // 在node子进程中调用
            const args = Array.from(arguments)
            const cmd = args[args.length-1]
            const o = Object.create(null)
            Object.keys(cmd).forEach(key => {
                if (cmd.hasOwnProperty(key) && 
                !key.startsWith('_') && key !== 'parent') {
                    o[key] = cmd[key]
                }
            })
            args[args.length - 1] = o
            const code = `require('${rootFile}').apply(null, ${JSON.stringify(args)})`
            const child = cp.spawn('node', ['-e', code], {
                cwd: process.cwd(),
                stdio: 'inherit'
            })
            child.on('error', e => {
                log.error(e.message)
                process.exit(1)
            })
            child.on('exit', e => {
                log.verbose('命令执行成功:', e)
                process.exit(e)
            })
        } catch (error) {
            log.error(error)
        }
    }
}

function spawn(command, args, options) {
    const win32 = process.platform === 'win32'
    const cmd = win32 ? 'cmd' : command
    const cmdArgs = win32 ? ['/c'].concat(command, args) : args

    return cp.spawn(cmd, cmdArgs, options || {})
}

module.exports = exec;
