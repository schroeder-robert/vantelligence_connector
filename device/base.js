import chalk from 'chalk'
import { SerialPort } from 'serialport'
import { InterByteTimeoutParser } from '@serialport/parser-inter-byte-timeout'

export default class {
  constructor (config) {
    this.manufacturer = 'DEFAULT'
    this.model = 'DEFAULT'
    this.config = config
    this.options = {}
    this.onMessageCallback = null
    this.onEntityUpdateCallback = null
  }

  get name () {
    return this.config.name
  }

  get id () {
    return this.config.id
  }

  onMessage (callback) {
    this.onMessageCallback = callback
  }

  onEntityUpdate (callback) {
    this.onEntityUpdateCallback = callback
  }

  log (message, icon) {
    if (typeof this.onMessageCallback === 'function') {
      this.onMessageCallback(icon ? icon : 'ℹ️', message)
    }
  }

  error (message) {
    this.log(message, '🛑')
  }

  warning (message) {
    this.log(message, '⚠️')
  }

  info (message) {
    this.log(message, 'ℹ️')
  }

  emitEntity (entity) {
    if (typeof this.onEntityUpdateCallback === 'function') {
      this.onEntityUpdateCallback(entity)
    }
  }

  async poll (time, method, interval) {
    if (typeof method === 'function') {
      const call = async () => {
        // console.log(this.id)
        try {
          await method()
        } catch (e) {
          this.error('Poll error: ' + e)
        }

        if (!interval) {
          setTimeout(call, time)
        }
      }

      if (!!interval) {
        setInterval(call, time)
      }
      
      call()
    }
  }

  async wait (time) {
    return new Promise(resolve => setTimeout(resolve, time))
  }

  async handle (entity, state, value) {
    const method = 'set' + this.convertKeyToMethod(entity)

    if (typeof this[method] === 'function') {
      try {
        return await this[method](value, state)
      } catch (error) {
        this.error(error)
      }
    } else {
      this.warning('Method "' + chalk.red(method) + '" not found!')
    }
  }

  disconnect () {}

  convertKeyToMethod (value) {
    return String(value).replace(/((^|[_])[a-z])/ig, match => match.toUpperCase().replace('_', ''))
  }

  convertNameToKey (value) {
    return String(value).toLowerCase().replace(/[ ]/g, '_')
  }

  createSerialConnection (options) {
    let port = null
    let parser = null

    const connect = () => {
      port = new SerialPort(Object.assign({ autoOpen: false }, options))
      parser = port.pipe(new InterByteTimeoutParser({ interval: 100 }))

      port.open(error => {
        if (error) {
          this.error(error.message)
          this.info('Retrying in 10s')
          
          setTimeout(connect, 10000)
        } else {
          this.info('Serial connection successful')
        }
      })
      port.on('error', error => this.error(error.message))
      port.on('close', () => {
        this.warning('Lost connection!')
        
        connect()
      })  
    }

    connect()

    return function (bytes) {
      return new Promise((resolve, reject) => {

        try {
          let timeout = setTimeout(() => reject('request timeout'), 3000)

          parser.once('data', data => {
            clearTimeout(timeout)
            resolve(data)
          })

          port.write(Buffer.from(bytes), error => {
            if (error) {
              this.error(error)
    
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
}