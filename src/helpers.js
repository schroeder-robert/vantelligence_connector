import { SerialPort } from 'serialport'
import { InterByteTimeoutParser } from '@serialport/parser-inter-byte-timeout'

export async function poll (logPrefix, time, method, interval) {
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

export async function wait (time) {
  return new Promise(resolve => setTimeout(resolve, time))
}

export function convertKeyToMethod (value) {
  return String(value).replace(/((^|[_])[a-z])/ig, match => match.toUpperCase().replace('_', ''))
}

export function convertNameToKey (value) {
  return String(value).toLowerCase().replace(/[ ]/g, '_')
}

export function createSerialConnection (logPrefix, options, parser, callback) {
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

export function getSerialDevices () {
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

export function log () {
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

export function logError () {
  return log('error', ...arguments)
}