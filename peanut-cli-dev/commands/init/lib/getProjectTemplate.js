const request = require('@peanut-cli-dev/request')

module.exports = function() {
    return request({
        url: '/project/template'
    })
}