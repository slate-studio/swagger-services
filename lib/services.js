'use strict'

const SwaggerClient = require('swagger-client')

var retryTimeout = 2
if (process.env.NODE_ENV == 'test') {
  retryTimeout = 0.01
}

const createSwaggerClient = (pkgName, options) => {
  const name = options.name
  const apiName = `${name} (${pkgName})`
  const swagger = options.swagger
  log.info(`=> Connecting ${apiName}: ${swagger}`)

  const onSwaggerError = (err) => {
    log.error(err)

    setTimeout(() => {
      createSwaggerClient(pkgName, options)
    }, retryTimeout * 1000)
  }

  S[name] = {}

  const client = new SwaggerClient({
    url:     swagger,
    failure: onSwaggerError,
    error:   onSwaggerError,
    success: () => {
      S[name].client = client
      log.info(`=> ${apiName} is connected`)
    }
  })

  const sendRequest = (tag, operationId, params, success, onError) => {
    const clientAuthorizations = {}
    if (params.clientAuthorizations) {
      clientAuthorizations.clientAuthorizations = params.clientAuthorizations
      delete params.clientAuthorizations
    }

    S[name].client[tag][operationId](params, clientAuthorizations, success, (err) => {
      if (err.errObj.code == 'ECONNRESET' ||
          err.errObj.code == 'EPIPE' ||
          err.errObj.code == 'ETIMEDOUT') {
        log.error(`=> ${apiName} ${err.errObj.code}, retry in 0.5s`)

        setTimeout(() => {
          sendRequest(tag, operationId, params, success, onError)
        }, 500 )

      } else {
        log.error(err.obj || err)
        if (onError) {
          onError(err)
        }

      }
    })
  }

  const sendRequestWhenServiceReady = (tag, operationId, params, success, error) => {
    if (S[name].client) {
      sendRequest(tag, operationId, params, success, error)

    } else {
      log.error(`=> ${apiName} is not connected, retry in ${retryTimeout}s`)

      setTimeout(() => {
        sendRequestWhenServiceReady(tag, operationId, params, success, error)
      }, retryTimeout * 1000)
    }
  }

  const send = (tag, operationId, params, success, error) => {
    log.info(`=> ${name}.${tag}.${operationId}`, params)
    sendRequestWhenServiceReady(tag, operationId, params, success, error)
  }

  S[name].send = send
}

module.exports = () => {
  if (C.services) {
    Object.keys(C.services).forEach((pkgName) => {
      createSwaggerClient(pkgName, C.services[pkgName])
    })
  }
}
