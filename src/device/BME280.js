import BME280 from 'bme280-sensor'
import base from './base.js'

const ADDRESS = 0x76

export const info = {
  manufacturer: 'Bosch',
  model: 'BME280',
  version: '1'
}

export const device = class extends base {
  constructor (config) {
    super(info, config)
    
    this.sensor = null
  }

  async connect () {
    const { connection } = this.config

    this.sensor = new BME280({
      i2cBusNo: parseInt(connection.bus),
      i2cAddress: ADDRESS
    })

    await this.sensor.init()

    this.poll(10000, async () => this.processMessage(await this.sensor.readSensorData()))
  }

  processMessage (values) {
    if (values?.temperature_C) {
      this.emitEntity({
        name: 'Temperatur',
        key: 'temperature',
        class: 'temperature',
        unit: '°C',
        states: {
          state: Math.round(values.temperature_C * 10) / 10
        }
      })
    }
    
    if (values?.humidity) {
      this.emitEntity({
        name: 'Feuchtigkeit',
        key: 'humidity',
        class: 'humidity',
        unit: '%',
        states: {
          state: Math.round(values.humidity * 10) / 10
        }
      })
    }
    
    if (values?.pressure_hPa) {
      this.emitEntity({
        name: 'Druck',
        key: 'pressure',
        class: 'pressure',
        unit: 'hPa',
        states: {
          state: Math.round(values.pressure_hPa * 10) / 10
        }
      })
    }
  }
}