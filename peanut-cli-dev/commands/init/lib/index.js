'use strict';

const Command = require('@peanut-cli-dev/command')
const log = require('@peanut-cli-dev/log')
const fs = require('fs')
const fse = require('fs-extra')
const inquirer = require('inquirer')
const path = require('path')
const semver = require('semver')
const userHome = require('user-home')
const Package = require('@peanut-cli-dev/package')
const TYPE_PROJECT = 'project'
const TYPE_COMPONENT = 'component'
const { spinnerStart, sleep, execAsync } = require('@peanut-cli-dev/utils')
const getProjectTemplate = require('./getProjectTemplate')
const WHITE_COMMAND = ['npm']
const TEMPLATE_TYPE_NORMAL = 'normal';
const TEMPLATE_TYPE_CUSTOM = 'custom';
const ejs = require('ejs')
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
                this.projectInfo = projectInfo
                // 2.下载模板
                await this.downloadTemplate()

                // 3.安装模板
                await this.installTemplate()
            }
            // 3.安装模板
        } catch (error) {
            console.log('exec error', error)
        }
    }

    async execCommand(command, errorMsg) {
        let ret
        if (command) {
            const cmdArray = command.split(' ')
            const cmd = this.checkCommand(cmdArray[0])
            if (!cmd) {
                throw new Error('命令不存在！命令：', command)
            }
            const args = cmdArray.slice(1)
            ret = await execAsync(cmd, args, {
                stdio: 'inherit',
                cwd: process.cwd()
            })
        }
        if (ret !== 0) {
            throw new Error(errorMsg)
        }
        return ret
    }

    async installTemplate() {
        if (this.templateInfo) {
            if (!this.templateInfo.type) {
                this.templateInfo.type = TEMPLATE_TYPE_NORMAL
            }
            if (this.templateInfo.type === TEMPLATE_TYPE_NORMAL) {
                // 标准安装
                await this.installNormalTemplate()
            } else if (this.templateInfo.type === TEMPLATE_TYPE_CUSTOM) {
                // 自定义安装
                await this.installCustomTemplate()
            } else {
                throw new Error('无法识别项目模板类型')
            }
        } else {
            throw new Error('项目信息模板不存在')
        }
    }

    checkCommand (cmd) {
        if (WHITE_COMMAND.includes(cmd)) {
            return cmd
        } 
        return null
    }

    async installNormalTemplate () {
        log.verbose('templateNpm', this.templateNpm)
        let spinner = spinnerStart('正在安装模板')
        await sleep()

        try {
            const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template')
            const targetPath = process.cwd()
            fse.ensureDirSync(templatePath)
            fse.ensureDirSync(targetPath)
            fse.copySync(templatePath, targetPath)
        } catch (e) {
            throw e
        } finally {
            spinner.stop(true)
            log.success('模板安装成功')
            const { installCommand, startCommand } = this.templateInfo
            await this.execCommand(installCommand, '依赖过程安装失败！')

            // await this.execCommand(startCommand, '依赖过程安装失败！')
        }
        const templateIgnore = this.templateInfo.ignore || []
        const ignore = ['**/node_modules/**', ...templateIgnore]
        await this.ejsRender(ignore)
        const { installCommand, startCommand } = this.templateInfo
    }

    async installCustomTemplate () {
        console.log('安装自定义模板')
    }

    async downloadTemplate() {
        // 1.通过项目模板api获取项目模板信息
        // 1.1 通过egg.js搭建一套后端系统
        // 1.2 通过npm模板存储项目
        // 1.3 将项目模板信息存储到mongoDB数据库中
        // 1.4 通过egg.js获取mongoDB数据库中的数据库并通过api返回
        const { projectTemplate } = this.projectInfo
        const templateInfo = this.template.find(item => item.npmName === projectTemplate)
        const targetPath = path.resolve(userHome, '.peanut-cli-dev', 'template')
        const storeDir = path.resolve(userHome, '.peanut-cli-dev', 'template')
        const { npmName, version } = templateInfo
        this.templateInfo = templateInfo 
        const templateNpm = new Package({
            targetPath,
            storeDir,
            packageName: npmName,
            packageVersion: version
        })
        if (! await templateNpm.exists()) {
            const spinner = spinnerStart('正在下载模板。。。')
            await sleep()
            try {
                await templateNpm.install()
            } catch (error) {
                throw error
            } finally {
                spinner.stop(true)
                if (await templateNpm.exists()) {
                    log.success('下载模板成功')
                    this.templateNpm = templateNpm
                }
            }
        } else {
            const spinner = spinnerStart('正在更新模板。。。')
            await sleep()
            try {
                await templateNpm.update()
            } catch (error) {
                throw error
            } finally {
                spinner.stop(true)
                if (await templateNpm.exists()) {
                    log.success('更新模板成功')
                    this.templateNpm = templateNpm
                }
            }
        }
    }

    async prepare() {
        // 0.判断项目模板是否存在
        const template = await getProjectTemplate()
        if (!template || template.length === 0) {
            throw new Error('项目模板不存在')
        }
        this.template = template
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

        return await this.getProjectInfo()
    }

    async getProjectInfo() {
        function isValidName(v) {
            return /^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/.test(v)
        }
        let projectInfo = {}
        let isProjectNameValid = false
        if (isValidName(this.projectName)) {
            isProjectNameValid = true
            projectInfo.projectName = this.projectName
        }
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
        this.template = this.template.filter(template => template.tag.includes(type ))
        const title = type === TYPE_PROJECT ? '项目' : '组件'

        const projectNamePrompt =  {
            type: 'input',
            message: `请输入${title}名称`,
            name: 'projectName',
            default: '',
            validate: function(v) {
                const done = this.async()
                setTimeout(() => {
                    if (!isValidName(v)) {
                        done(`请输入合法的${title}名称!`)
                        return
                    }
                    done(null, true)
                }, 0);
            },
            filter: function(v) {
                return v
            }
        }
        // 2.获取项目的基本信息
        const projectPrompt = []
        if (!isProjectNameValid) {
            projectPrompt.push(projectNamePrompt)
        }
        projectPrompt.push(
            {
                type: 'input',
                name: 'projectVersion',
                message: `请输入${title}版本号`,
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
            },
            {
                type: 'list',
                name: 'projectTemplate',
                message: `请选择${title}模板`,
                choices: this.createTemplateChoice()
            }
        )
        if (type === TYPE_PROJECT) { 
            const project = await inquirer.prompt(projectPrompt)
            projectInfo = {
                ...projectInfo,
                type,
                ...project
            }
        } else if (type === TYPE_COMPONENT) {
            const descriptionPrompt = {
                type: 'input',
                name: 'componentDescription',
                message: '请输入组件描述信息',
                default: '1.0.0',
            }
            projectPrompt.push(descriptionPrompt)
            const component = await inquirer.prompt(projectPrompt)
            projectInfo = {
                ...projectInfo,
                type,
                ...component
            }
        }
        // 最终项目的基本信息
        if (projectInfo.projectName) {
            projectInfo.name = projectInfo.projectName
            projectInfo.className = require('kebab-case')(projectInfo.projectName).replace(/^-/,'')
        }
        if (projectInfo.projectVersion) {
            projectInfo.version = projectInfo.projectVersion
        }
        if (projectInfo.componentDescription) {
            projectInfo.description = projectInfo.componentDescription
        }
        return projectInfo
    }

    async ejsRender(ignore) {
        const dir = process.cwd()
        const projectInfo = this.projectInfo;
        return new Promise((resolve, reject) => {
            require('glob')('**', {
                cwd: dir,
                ignore,
                nodir: true
            }, (err, files) => {
                if (err) {
                    // console.log('err', err)
                    // console.log('files', files)
                    reject(err)
                }
                Promise.all(files.map(file => {
                    const filePath = path.join(dir, file)
                    return new Promise((resolve1, reject1) => {
                        ejs.renderFile(filePath, projectInfo, (err, result) => {
                            console.log(err, result)
                            if (err) {
                                reject1(err)
                            } else {
                                fse.writeFileSync(filePath, result);
                                resolve1(result)
                            }
                        })
                    })
                })).then(() => {
                    resolve()
                })
                // console.log('files', files)
            })
        })
    }

    createTemplateChoice() {
        return this.template.map(item => ({
            value: item.npmName,
            name: item.name
        }))
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
