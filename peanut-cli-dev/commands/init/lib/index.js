'use strict';

const Command = require('@peanut-cli-dev/command')
const log = require('@peanut-cli-dev/log')
const fs = require('fs')
const fse = require('fs-extra')
const inquirer = require('inquirer')
const semver = require('semver')

const TYPE_PROJECT = 'project'
const TYPE_COMPONENT = 'project'

class InitCommand extends Command {
    init() {
        this.projectName = this._argv[0] || ''
        this.force = !!this._cmd.force
        log.verbose('projectName', this.projectName)
        log.verbose('force', this.force) 
    }

    async exec() {
        try {
            // 1.准备模板
            const projectInfo = await this.prepare()
            if (projectInfo) {
                log.verbose('projectInfo', projectInfo)
                // 2.下载模板
                this.downloadTemplate()

            }

            // 3.安装模板
        } catch (error) {
            
        }
    }

    downloadTemplate() {
        // 1.通过项目模板api获取项目模板信息
        // 1.1 通过egg.js搭建一套后端系统
        // 1.2 通过npm模板存储项目
        // 1.3 将项目模板信息存储到mongoDB数据库中
        // 1.4 通过egg.js获取mongoDB数据库中的数据库并通过api返回

    }

    async prepare() {
        // 1.判断当前目录是否为空
        const localPath = process.cwd()
        if (!this.isDirEmpty()) {
            let ifContinue = false;
            if (!this.force) {
                const res = await inquirer.prompt({
                    type: 'confirm',
                    name: 'continue',
                    default: false,
                    message: '当前文件夹不为空，是否继续创建项目？'
                });
                ifContinue = res.continue
                if (!ifContinue) return
            }
            if(ifContinue || this.force) {
                // 给用户做二次确认
                const { confirmDelete } = await inquirer.prompt({
                    type: 'confirm',
                    name: 'confirmDelete',
                    default: false,
                    message: '是否确认清空当前目录下的文件?'
                });
                if (confirmDelete) {
                    // 2.是否强制启动更新
                    fse.emptyDirSync(localPath)
                }
            }
        }

        return this.getProjectInfo()
    }

    async getProjectInfo() {
        let projectInfo = {}
        // 1.选择创建项目或者组件
        const { type } = await inquirer.prompt({
            type: 'list',
            name: 'type',
            message: '请选择初始化类型',
            default: TYPE_PROJECT,
            choices: [
                {
                    name: '项目',
                    value: TYPE_PROJECT
                },
                {
                    name: '组件',
                    value: TYPE_COMPONENT
                }
            ]
        })
        log.verbose('type', type)
        if (type === TYPE_PROJECT) {
            // 2.获取项目的基本信息
            const project = await inquirer.prompt([{
                type: 'input',
                message: '请输入项目名称',
                name: 'projectName',
                default: '',
                validate: function(v) {
                    const done = this.async()
                    setTimeout(() => {
                        if (!/^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/.test(v)) {
                            done('请输入合法的项目名称!')
                            return
                        }
                        done(null, true)
                    }, 0);
                },
                filter: function(v) {
                    return v
                }
            }, {
                type: 'input',
                name: 'projectVersion',
                message: '请输入项目版本号',
                default: '1.0.0',
                validate: function(v) {
                    const done = this.async()
                    setTimeout(() => {
                        if (!(!!semver.valid(v))) {
                            done('请输入合法的版本号!')
                            return
                        }
                        done(null, true)
                    }, 0);
                },
                filter: function(v) {
                    if (!!semver.valid(v)) {
                        return semver.valid(v)
                    } 
                    return v
                }
            }])
            projectInfo = {
                type,
                ...project
            }
        } else if (type === TYPE_COMPONENT) {

        }
        // 最终项目的基本信息

        return projectInfo
    }

    isDirEmpty() {
        const localPath = process.cwd()
        let fileList = fs.readdirSync(localPath)
        fileList = fileList.filter(file => (
            !file.startsWith('.') && ['node_modules'].indexOf(file) < 0
        ))
        return !fileList || fileList.length <= 0
    }
}



function init(...argv) {
    return new InitCommand(argv)
}

module.exports = init;
module.exports.InitCommand = InitCommand;
