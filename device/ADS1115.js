import ADS1115 from 'ads1115'
import Device from './base.js'

const ADDRESS = 0x48

export default class extends Device {
  constructor (config) {
    super(config)
    
    this.manufacturer = 'Texas Instruments'
    this.model = 'ADS1115'
    this.version = '1'
    this.sensor = null
  }

  async connect () {
    const { connection, values } = this.config

    try {
      this.sensor = await ADS1115.open(parseInt(connection.bus), ADDRESS, 'i2c-bus')
      this.sensor.gain = 2
    } catch (error) {
      return 'ADS1115 initialization failed: ' + error
    }

    this.poll('requestData', 2000, result => this.processMessage(result))
  }

  async requestData () {
    return [
      await this.sensor.measure('0+GND'),
      await this.sensor.measure('1+GND'),
      await this.sensor.measure('2+GND'),
      await this.sensor.measure('3+GND')
    ]
  }

  processMessage (values) {
    this.emitEntity({
      name: 'Wert #0',
      key: 'value0',
      class: 'temperature',
      unit: '°C',
      states: {
        state: values[0]
      }
    })
    
    this.emitEntity({
      name: 'Wert #1',
      key: 'value1',
      class: 'temperature',
      unit: '°C',
      states: {
        state: values[1]
      }
    })
    
    this.emitEntity({
      name: 'Wert #2',
      key: 'value2',
      class: 'temperature',
      unit: '°C',
      states: {
        state: values[2]
      }
    })
    
    this.emitEntity({
      name: 'Wert #3',
      key: 'value3',
      class: 'temperature',
      unit: '°C',
      states: {
        state: values[3]
      }
    })
  }
}
