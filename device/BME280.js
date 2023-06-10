import BME280 from 'bme280-sensor'
import Device from './base.js'

const ADDRESS = 0x76

export default class extends Device {
  constructor (config) {
    super(config)
    
    this.manufacturer = 'Bosch'
    this.model = 'BME280'
    this.version = '1'
    this.sensor = null
  }

  async connect () {
    const { connection } = this.config
    const log = console.log

    console.log = () => {}

    this.sensor = new BME280({
      i2cBusNo: parseInt(connection.bus),
      i2cAddress: ADDRESS
    })

    try {
      await this.sensor.init()

      console.log = log
    } catch (error) {
      return 'BME280 initialization failed: ' + error
    }

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