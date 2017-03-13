'use strict'

const _       = require('lodash')
const faker   = require('faker')
const nock    = require('nock')
const appRoot = require('app-root-path')

const buildFakeObjectFromDefinition = (definition) => {
  const result = {}

  _.forEach(definition, (def, name) => {
    var value

    if (def.hasOwnProperty('default')) {
      value = def.default

    } else if (def.hasOwnProperty('format')) {
      switch (def.format) {
        case 'uuid':
          value = faker.random.uuid()
          break

        case 'date-time':
        case 'date':
          value = faker.date.recent()
          break

        default:
          value = faker.lorem.word()
          break
      }

    } else {
      switch (def.type) {
        case 'integer':
          value = faker.random.number()
          break

        case 'boolean':
          value = true
          break

        case 'array':
          value = []
          break

        default:
          value = faker.lorem.word()
          break
      }
    }

    result[name] = value
  })

  return result
}

const waitForSwagger = (swaggerNock, cb) => {
  setTimeout(() => {
    if (swaggerNock.isDone())
      return cb()

    else
      return waitForSwagger(swaggerNock, cb)

  }, 100)
}

const createServiceMock = (pkgName, options) => {
  const name    = options.name
  const swagger = options.swagger
  const local   = options.local
  const schema  = require(`${appRoot}/${local}`)
  schema.host = schema.host.replace('localhost', '127.0.0.1')

  const host  = `http://${schema.host}`.replace('localhost', '127.0.0.1')
  const swaggerPath = _.replace(swagger, host, '')

  M[name] = {}
  M[name].host = host

  M[name].mockSwagger = (cb) => {
    log.info(name)

    if (S[name].client) {
      cb()

    } else {
      const swaggerNock = nock(host)
                            .get(swaggerPath)
                            .reply(200, schema)
      waitForSwagger(swaggerNock, cb)

    }
  }

  M[name].fakeObject = (definitionName) => {
    const definition = S[name].client.definitions[definitionName].properties
    return buildFakeObjectFromDefinition(definition)
  }

  M[name].actionPath = (tag, operationId, params) => {
    var url = S[name].client[tag].operations[operationId].urlify(params)
    url = _.replace(url, host, '')
    return url
  }

  M[name].mock = (tag, operationId, params, response = {}) => {
    // NOTE: Generate successful reponse by default if no response provided.
    if (_.isEmpty(response)) {
      const successResponse = S[name].client[tag].operations[operationId].successResponse
      const successStatus = successResponse ? _.keys(successResponse)[0] : 200

      const definition = successResponse[successStatus].definition.properties
      const fakeObject = buildFakeObjectFromDefinition(definition)

      response = {
        status: successStatus,
        object: fakeObject
      }
    }

    const method = S[name].client[tag].operations[operationId].method
    const actionPath = M[name].actionPath(tag, operationId, params)

    return nock(host)[method](actionPath).reply(response.status, response.object)
  }
}

const mocks = () => {
  if (C.services) {
    Object.keys(C.services).forEach((pkgName) => {
      createServiceMock(pkgName, C.services[pkgName])
    })
  }

  M.mockConnections = (cb) => {
    if (C.services) {
      var servicesCounter = 0

      Object.keys(C.services).forEach((pkgName) => {
        const name = C.services[pkgName].name

        new Promise((resolve) => {
          M[name].mockSwagger(resolve)
        }).then(() => {
          servicesCounter += 1
          if (Object.keys(C.services).length == servicesCounter)
            cb()
        })
      })

    } else {
      cb()

    }
  }
}

module.exports = mocks
