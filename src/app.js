import process from 'node:process'
import mqtt from 'mqtt'
import fs from 'fs'
import YAML from 'yaml'
import http from 'http'
import url from 'url'
import path from 'path'
import { entityCategories, entityClasses, entityUnits, stateValues } from './maps.js'
import { WebSocketServer } from 'ws'
import { SerialPort } from 'serialport'
import { InterByteTimeoutParser } from '@serialport/parser-inter-byte-timeout'

const MQTT_HOST = process.env.CONNECTOR_MQTT_HOST || 'localhost'
const MQTT_PORT = process.env.CONNECTOR_MQTT_PORT || 1883
const MQTT_USERNAME = process.env.CONNECTOR_MQTT_USERNAME || 'test'
const MQTT_PASSWORD = process.env.CONNECTOR_MQTT_PASSWORD || 'test'
const CONFIG_FILE = process.env.CONNECTOR_CONFIG_FILE || './config/config.yaml'
const HA_SUPPORT = true

const BASE_TOPIC = 'connector'
const DEVICE_TOPIC = 'device'
const DEVICE_CLASSES = {}
const HA_BASE_TOPIC = 'homeassistant'

const modulePath = './modules/'
const valueStore = {}
const callbackStore = {}
const websocketStore = []

let mqttClient
let mqttConfig = []
let fullConfig

try {
  if (!fs.existsSync(CONFIG_FILE)) throw new Error('No config file found!')

  const startups = []

  fullConfig = YAML.parse(String(fs.readFileSync(CONFIG_FILE)))
  mqttClient = connectMqtt(MQTT_HOST, MQTT_PORT, MQTT_USERNAME, MQTT_PASSWORD)
  startHttp()

  mqttConfig = await (() => new Promise(resolve => {
    const timeout = setTimeout(() => {
      logError('Config timeout')
      resolve({})
    }, 1000)
    
    subscribe(BASE_TOPIC, m => {
      clearTimeout(timeout)
      resolve(JSON.parse(m))
    })
  }))()

  for (let config of fullConfig.modules instanceof Array ? fullConfig.modules : []) {
    if (config) startups.push(init(config))
  }

  Promise.all(startups).then((values) => {
    log('Module initialization done!')

    console.table(values)
  })
} catch (error) {
  logError('INIT ERROR', error)
}

async function configAdd (data) {
  mqttConfig.push(data)

  publish(BASE_TOPIC, mqttConfig)

  await init(data)

  log('UC', data)
}

async function configRemove (id) {
  mqttConfig.splice(mqttConfig.findIndex(m => {
    if (!m) return
    return m.id === id
  }), 1)
  
  publish(BASE_TOPIC, mqttConfig)
}

async function init (config) {
  const path = modulePath + config.type + '.js'
  const logPrefix = '[ ' + config.name + ' ]'
    
  try {
    const module = await import(path)

    if (typeof module.default !== 'function') throw new Error('Not a function!')

    await module.default({
      restart: function (delay) { return setTimeout(() => { init(config) }, delay || 3000) },
      prop: function () { return prop(config, ...arguments) },
      device: function () { return device(config, ...arguments) },
      log: function () { return log(logPrefix, ...arguments) },
      logError: function () { return logError(logPrefix, ...arguments) },
      on: function () { return on(config, ...arguments) },
      poll: function () { return poll(logPrefix, ...arguments) },
      wait,
      convertKeyToMethod,
      convertNameToKey,
      getSerialDevices,
      createSerialConnection: function () { return createSerialConnection(logPrefix, ...arguments) },
      modulePath,
      mqttConfig,
      configAdd,
      configRemove,
      stateValues,
      entityClasses,
      entityCategories,
      entityUnits
    })

    log(logPrefix, 'Created ' + config.type + ' instance:', config.name)
  } catch (error) {
    logError(logPrefix, 'Module init error:', error)
  }

  return { type: config.type, id: config.id, name: config.name }
}

function prop (config, key, def) {
  return key ? (key in config ? config[key] : def) : config
}

function device (config, manufacturer, model, version) {
  const data = {
    topic: topic(config.id),
    id: config.id,
    name: config.name,
    manufacturer,
    model,
    version,
    entities: {}
  }

  publish(data.topic, data)

  return {
    sensor: function () { return entity(data, 'sensor', ...arguments) },
    binarySensor: function () { return entity(data, 'binary_sensor', ...arguments) },
    switch: function () { return entity(data, 'switch', ...arguments) },
    button: function () { return entity(data, 'button', ...arguments) },
    select: function () { return entity(data, 'select', ...arguments) },
    text: function () { return entity(data, 'text', ...arguments) },
    number: function () { return entity(data, 'number', ...arguments) },
    light: function () { return entity(data, 'light', ...arguments) },
    tracker: function () { return entity(data, 'tracker', ...arguments) },
    entity: function () { return entity(data, ...arguments) }
  }
}

function entity (device, type, id, name, attributes, calls = {}) {
  const data = {
    topic: topic(device.id, id),
    type,
    id,
    name: name || id,
    states: {
      state: topic(device.id, id, 'state')
    }
  }

  switch (type) {
    case 'sensor':
      data.class = attributes?.class || entityClasses[id]
      data.unit = {
        [entityClasses.temperature]: entityUnits.celsius,
        [entityClasses.illuminance]: entityUnits.lx,
        [entityClasses.voltage]: entityUnits.volt,
        [entityClasses.current]: entityUnits.ampere
      }[data.class]

      break
    
    case 'tracker':
      data.states.json_attributes = topic(device.id, id, 'json_attributes')

      break

    case 'switch':
    case 'button':
    case 'select':
    case 'text':
    case 'number':
    case 'light':
      data.commands = {
        command: topic(device.id, id, 'command')
      }

      break
  }

  Object.assign(data, attributes)

  device.entities[id] = data

  publish(data.topic, data)
  publishHomeAssistantDiscovery(device, data)

  const methods = {
    availability: function () { return availability(device, data, ...arguments) },
    state: function () { return state(device, data, 'state', ...arguments) },
    stateById: function () { return state(device, data, ...arguments) },
    command: function () { return command(device, data, 'command', ...arguments) },
    commandById: function () { return command(device, data, ...arguments) },
    update: function () { return update(device, data) },
    get: function () { return get(data, ...arguments) },
    set: function () { return set(data, ...arguments) }
  }

  if (Object.entries(calls).length) {
    for (const key in calls) {
      if (key in methods) methods[key](calls[key])
    }
  }

  return methods
}

function get (entity, attribute) {
  return entity[attribute]
}

function set (entity, attribute, value) {
  entity[attribute] = value
}

function update (device, entity) {
   publishHomeAssistantDiscovery(device, entity)
}

function availability (device, entity, value) {
  if (value === undefined) return entity.states[id]
  
  if (!('availability' in entity)) {
    entity.availability = topic(device.id, entity.id, 'availability')

    update(device, entity)
  }

  publish(entity.availability, value)
}

function state (device, entity, id, value) {
  const current = valueStore[entity.states[id]]

  if (value === undefined) return current

  value = value instanceof Object ? JSON.stringify(value) : value

  if (value !== current) publish(entity.states[id], value)

  return value
}

function command (device, entity, id, callback) {
  if (callback === undefined) return callbackStore[entity.commands[id]]

  subscribe(entity.commands[id], callback)
}

function topic () {
  return [BASE_TOPIC, DEVICE_TOPIC, ...Array.from(arguments)].join('/')
}

function on (config, key, callback) {
  if (!('subscribe' in config && key in config.subscribe)) return

  subscribe(config.subscribe[key], callback)
}

async function poll (logPrefix, time, method, interval) {
  let id

  if (typeof method === 'function') {
    let cycle = 0
    const call = async () => {
      try {
        await method(cycle++)
      } catch (e) {
        logError(logPrefix, 'Poll /', e)
      }

      if (!interval) {
        id = setTimeout(call, time)
      }
    }

    if (!!interval) {
      id = setInterval(call, time)
    }
    
    call()
  }

  return {
    stop () {
      if (id) {
        !interval ? clearTimeout(id) : clearInterval(id)
      }
    }
  }
}

async function wait (time) {
  return new Promise(resolve => setTimeout(resolve, time))
}

function convertKeyToMethod (value) {
  return String(value).replace(/((^|[_])[a-z])/ig, match => match.toUpperCase().replace('_', ''))
}

function convertNameToKey (value) {
  return String(value).toLowerCase().replace(/[ ]/g, '_')
}

function createSerialConnection (logPrefix, options, parser, callback) {
  let port = null
  let pipe = null

  const connect = () => {
    log(logPrefix, 'Connectiong to serial device:', options.path)

    port = new SerialPort(Object.assign({ autoOpen: false }, options))
    port.open(error => {
      if (error) {
        logError(logPrefix, error.message)
        log(logPrefix, 'Retrying in 10s')
        
        setTimeout(connect, 10000)
      } else {
        log(logPrefix, 'Serial connection successful')
      }
    })
    port.on('error', error => logError(error.message))
    port.on('close', () => {
      logError(logPrefix, 'Lost connection!')
      
      connect()
    })

    pipe = port.pipe(parser || new InterByteTimeoutParser({ interval: 100 }))
    
    if (typeof callback === 'function') {
      pipe.on('data', callback)
    }
  }

  connect()

  return function (bytes) {
    return new Promise((resolve, reject) => {

      try {
        let timeout = setTimeout(() => reject('request timeout'), 3000)

        pipe.once('data', data => {
          clearTimeout(timeout)
          resolve(data)
        })

        port.write(Buffer.from(bytes), error => {
          if (error) {
            logError(logPrefix, error)
  
            reject('error')
          } else {
            clearTimeout(timeout)
            timeout = setTimeout(() => reject('response timeout'), 3000)
          }
        })
      } catch (e) {
        console.log(e)

        reject('catch')
      }
    })
  }
}

function getSerialDevices () {
  return new Promise(resolve => {
    const path = '/dev/serial/by-path'

    fs.readdir(path, async (error, files) => {
      if (error) {
        return logError(error)
      }

      resolve(Object.fromEntries(files.map(f => [path + '/' + f, path + '/' + f])))
    })
  })
}

function log () {
  const args = Array.from(arguments)
  const types = {
    info: '\x1b[37m%s\x1b[0m',
    error: '\x1b[31m%s\x1b[0m',
    warn: '\x1b[33m%s\x1b[0m'
  }

  let type = 'info'

  if (args[0] in types) {
    type = args[0]
    args.shift()
  }

  console.log(types[type], '[' + (new Date()).toISOString() + ']', '[ ' + type.toUpperCase() + ' ]', ...args)
}

function logError () {
  return log('error', ...arguments)
}

function startHttp () {
  const host = 'localhost'
  const port = 8066
  const websocket = new WebSocketServer({ noServer: true })

  websocket.on('connection', client => {
    const connection = {
      send: data => client.send(JSON.stringify(data)),
      topics: []
    }

    websocketStore.push(connection)

    client.on('error', console.error)
    client.on('message', data => {
      data = JSON.parse(data)

      switch (data.request) {
        case 'config_file':
          connection.send({
            response: data.request,
            config_file: CONFIG_FILE
          })

          break
        
        case 'classes':
          connection.send({
            response: data.request,
            classes: Object.entries(DEVICE_CLASSES).map(([k, v]) => ({ class: k, ...v.info }))
          })

          break

        default:
          connection.topics.push(data.request)
      }

      // console.log('received: %s', data)
    })

    //client.send('welcome, there are others: ' + WS_CLIENTS.length)
  })

  const server = http.createServer((request, response) => {
    const types = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'text/json',
      '.svg': 'image/svg+xml'
    }

    let filename = path.join(process.cwd(), 'static', url.parse(request.url).pathname)

    try {
      if (!fs.existsSync(filename)) throw 404
      
      if (fs.statSync(filename).isDirectory()) {
        filename = path.join(filename, 'index.html')

        if (!fs.existsSync(filename)) throw 404
      }

      fs.readFile(filename, 'binary', (error, content) => {
        if (error) {
          response.write(error)
          
          throw 500
        }

        const headers = {}
        const contentType = types[path.extname(filename)]

        if (contentType) {
          headers['Content-Type'] = contentType
        }

        response.writeHead(200, headers)
        response.write(content, 'binary')
        response.end()
      })
    } catch (code) {
      response.writeHead(code, { 'Content-Type': 'text/plain' })
      
      switch (code) {
        case 404:
          response.write('Error 404: File not found')
      }
        
      response.end()
    }

  })

  server.on('upgrade', (request, socket, head) => {
    if (request.headers.upgrade === 'websocket') {
      websocket.handleUpgrade(request, socket, head, ws => websocket.emit('connection', ws, request))
    } else {
      socket.destroy()
    }
  })

  server.listen(port, () => {
    console.log(`Server is running on http://${host}:${port}`)
  })
}

function connectMqtt (host, port, username, password) {
  const client = mqtt.connect('mqtt://' + host, { port, username, password })

  client.on('message', react)
  client.on('error', error => {
    logError('Error connecting mqtt at "' + MQTT_HOST + ':' + MQTT_PORT + '" with user name "' + MQTT_USERNAME + '" and password "' + MQTT_PASSWORD + '": ' + error.message)
  })

  client.subscribe(BASE_TOPIC + '/#')

  return client
}

function publish (topic, value) {
  // log('Publishing to "' + topic + '":', value)
  // log('TYPE-------', typeof value)
  valueStore[topic] = value
  try {
    mqttClient.publish(topic, value instanceof Object ? JSON.stringify(value) : String(value), { retain: true })
  } catch (ex) {
    logError(ex)
  }
  // mqttClient.subscribe(topic)
  websocketStore.filter(c => c.topics.includes(topic)).forEach(c => c.send({ response: topic, value }))
}

function subscribe (topic, callback) {
  log('Subscribing to "' + topic + '"')
  // mqttClient.subscribe(topic)

  if (!(topic in callbackStore)) callbackStore[topic] = []

  callbackStore[topic].push(callback)
}

function react (topic, message) {
  if (topic in callbackStore) {
    callbackStore[topic].forEach(callback => {
      if (typeof callback === 'function') callback(String(message))
    })
  } else if (!(topic in valueStore)) {
    valueStore[topic] = String(message)
  }
}

function publishHomeAssistantDiscovery (device, entity) {
  if (!HA_SUPPORT) return

  const id = device.id + '_' + entity.id
  const data = {
    name: entity.name,
    object_id: id,
    unique_id: id,
    device_class: entity.class,
    icon: entity.icon,
    device: {
      name: device.name,
      model: device.model,
      manufacturer: device.manufacturer,
      sw_version: device.version,
      identifiers: [ device.id ]
    }
  }

  if (typeof entity.category === 'string') {
    data.entity_category = entity.category
  }

  let type = entity.type || 'sensor'

  switch (type) {
    case 'sensor':
        type = 'sensor'

        data.unit_of_measurement = entity.unit

        break

    case 'switch':
      // data.payload_on = 'true'
      // data.payload_off = 'false'

      break
  
    case 'select':
      if (entity.options instanceof Object) {
        data.options = Object.values(entity.options)
        data.value_template = Object.entries(entity.options).map(([key, value], i) => '{% ' + (!i ? 'if' : 'elif') + ' value == "' + key + '" %}' + value).join('') + '{% endif %}'
        data.command_template = Object.entries(entity.options).map(([key, value], i) => '{% ' + (!i ? 'if' : 'elif') + ' value == "' + value + '" %}' + key).join('') + '{% endif %}'
      }

      break
    
    case 'climate':
      data.min_temp = entity.minTemp
      data.max_temp = entity.maxTemp
      data.temp_step = entity.tempStep
      data.modes = entity.modes,
      data.fan_modes = entity.fanModes
      data.payload_available = 'online'
      data.payload_not_available = 'offline'
      data.availability_topic = topic + '/state'

      break
    
    case 'number':
      data.min = entity.min
      data.max = entity.max
      data.step = entity.step
      data.mode = entity.mode
      data.unit_of_measurement = entity.unit

      break
    
    case 'light':
      data.brightness_scale = entity.brightnessScale
      data.schema = 'json'
      data.brightness = entity.brightness

      break
    
    case 'tracker':
      type = 'device_tracker'

      data.payload_home = 'home',
      data.payload_not_home = 'not_home'

      break

    case 'event':
      data.event_types = entity.events

      break
  }

  if (typeof entity.availability === 'string') {
    data['availability_topic'] = entity.availability
  }

  if (entity.states instanceof Object) {
    Object.keys(entity.states).forEach(state => {
      data[state + '_topic'] = entity.states[state]
    })
  }

  if (entity.commands instanceof Object) {
    Object.keys(entity.commands).forEach(command => {
      data[command + '_topic'] = entity.commands[command]
    })
  }

  mqttClient.publish([HA_BASE_TOPIC, type, id, 'config'].join('/'), JSON.stringify(data), { retain: true })
}

function logo (icon, message, device) {
  const content = (icon ? icon + '  ' : '') + (device ? ' ' + device.name + ' ' + ' ' : '') + message

  console.log(content)

  fs.writeFile('./debug.log', content + '\n', { flag: 'a+' }, err => {
    if (err) {
      console.error(err)
    }
  })
}

// process.on('unhandledRejection', (reason, promise) => {
//   log('💥', 'Unhandled Rejection at: ' + promise + ' reason:', reason)
// })