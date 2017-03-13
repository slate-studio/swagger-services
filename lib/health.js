'use strict'

const request = require('request')
const appRoot = require('app-root-path')

const sendSlackNotification = (options, errors) => {
  const slack = options.slack
  const name = options.name

  if (slack) {
    const endpoint = 'https://slack.com/api/chat.postMessage'
    const t = slack.token
    const c = slack.channel
    const u = name
    const i = 'https://avatars1.githubusercontent.com/u/6334870?v=3&s=70'
    const l = 'D00000'
    const m = errors.join('\n')

    const url = `${endpoint}?token=${t}&channel=${c}&text=&username=${u}&attachments=%5B%7B%22color%22%3A%20%22%23${l}%22%2C%20%22text%22%3A%20%22${m}%22%7D%5D&icon_url=${i}&pretty=1`
    request.get(url)
  }
}

const response = (res, options, errors) => {
  var status = 'ok'
  if (errors.length > 0) {
    status = 'error'
    sendSlackNotification(options, errors)
  }

  return res.status(200).json({
    name:    options.name,
    version: options.version,
    status:  status,
    errors:  errors
  })
}

const validateSwaggerSchemaVersion = (pkgName, options) => {
  return new Promise((resolve) => {
    const name   = pkgName
    const local  = options.local
    const schema = require(`${appRoot}/${local}`)
    const uri    = options.swagger

    if (!S[options.name].client) {
      return resolve(`${name}: Swagger schema is unreachable`)
    }

    request
      .get(uri, (error, res, body) => {
        if (error) {
          return resolve(error)
        }

        const remoteSchema = JSON.parse(body)
        const localVersion = schema.info.version
        const remoteVersion = remoteSchema.info.version
        if (localVersion != remoteVersion) {
          return resolve(`${name}: Swagger version mismatch, expected: v${localVersion}, returned: v${remoteVersion}`)
        }

        resolve()
      })
  })
}

const checkHealth = (options) => {
  return (req, res) => {
    var errors = []
    var counter = 0

    if (options.services) {
      Object.keys(options.services).forEach((pkgName) => {
        validateSwaggerSchemaVersion(pkgName, options.services[pkgName]).
          then((validationError) => {
            counter += 1

            if (validationError)
              errors.push(validationError)

            if (Object.keys(options.services).length == counter)
              response(res, options, errors)
          })
      })

    } else {
      return response(res, options, errors)

    }
  }
}

const health = (app) => {
  const basePath = C.app.basePath
  const options = {
    version:  require(`${appRoot}/package.json`).version,
    name:     C.app.name,
    slack:    C.slack,
    services: C.services || []
  }
  app.get(`${basePath}/health`, checkHealth(options))
}

module.exports = health
