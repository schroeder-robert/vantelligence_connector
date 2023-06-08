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

    const measure = async () => {
      const results = []

      for (const value of values) {
        results.push(await this.sensor.measure(value.measure))
      }

      return results
    }

    this.poll(measure, connection.interval, results => {console.log(results)
      for (let i in values) {
        const value = values[i]
        const range = value.max - value.min
        const result = Math.max(value.min, Math.min(value.max, results[i] > 32768 ? result[i] - 65536 : results[i]))
      
        this.emitEntity({
          name: value.name,
          key: this.convertNameToKey(value.name),
          unit: value.unit || '%',
          states: {
            state: Math.round(result / range * (value.scale || 100))
          }
        })
      }
    })
  }
}
