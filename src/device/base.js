import chalk from 'chalk'
import { SerialPort } from 'serialport'
import { InterByteTimeoutParser } from '@serialport/parser-inter-byte-timeout'

export const hidden = true

export default class {
  constructor (info, config) {
    this.manufacturer = info.manufacturer || 'DEFAULT'
    this.model = info.model || 'DEFAULT'
    this.version = info.version || '0'
    this.description = info.description || ''
    this.category = info.category || 'other'
    this.config = config
    this.options = {}
    this.onMessageCallback = null
    this.onEntityUpdateCallback = null
    this.TYPE = {
      binary_sensor: 'binary_sensor',
      sensor: 'sensor',
      switch: 'switch',
      light: 'light'
    }
    this.CATEGORY = {
      config: 'config',
      diagnostic: 'diagnostic'
    }
    this.CLASS = {
      apparent_power: 'apparent_power',
      aqi: 'aqi',
      area: 'area',
      atmospheric_pressure: 'atmospheric_pressure',
      battery: 'battery',
      blood_glucose_concentration: 'blood_glucose_concentration',
      carbon_dioxide: 'carbon_dioxide',
      carbon_monoxide: 'carbon_monoxide',
      current: 'current',
      data_rate: 'data_rate',
      data_size: 'data_size',
      date: 'date',
      distance: 'distance',
      duration: 'duration',
      energy: 'energy',
      energy_distance: 'energy_distance',
      energy_storage: 'energy_storage',
      enum: 'enum',
      frequency: 'frequency',
      gas: 'gas',
      humidity: 'humidity',
      illuminance: 'illuminance',
      irradiance: 'irradiance',
      moisture: 'moisture',
      monetary: 'monetary',
      nitrogen_dioxide: 'nitrogen_dioxide',
      nitrogen_monoxide: 'nitrogen_monoxide',
      nitrous_oxide: 'nitrous_oxide',
      ozone: 'ozone',
      ph: 'ph',
      pm1: 'pm1',
      pm25: 'pm25',
      pm10: 'pm10',
      power_factor: 'power_factor',
      power: 'power',
      precipitation: 'precipitation',
      precipitation_intensity: 'precipitation_intensity',
      pressure: 'pressure',
      reactive_power: 'reactive_power',
      signal_strength: 'signal_strength',
      sound_pressure: 'sound_pressure',
      speed: 'speed',
      sulphur_dioxide: 'sulphur_dioxide',
      temperature: 'temperature',
      timestamp: 'timestamp',
      volatile_organic_compounds: 'volatile_organic_compounds',
      volatile_organic_compounds_parts: 'volatile_organic_compounds_parts',
      voltage: 'voltage',
      volume: 'volume',
      volume_flow_rate: 'volume_flow_rate',
      volume_storage: 'volume_storage',
      water: 'water',
      weight: 'weight',
      wind_direction: 'wind_direction',
      wind_speed: 'wind_speed'
    }
    this.UNIT = {
      celsius: '°C',
      volt: 'V',
      ampere: 'A',
      percent: '%',
      hertz: 'Hz',
      rpm: 'RPM',
      ampereHour: 'Ah'
    }
    this.STATE = {
      on: 'ON',
      off: 'OFF'
    }
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

  createSerialConnection (options, parser, callback) {
    let port = null
    let pipe = null

    const connect = () => {
      port = new SerialPort(Object.assign({ autoOpen: false }, options))
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