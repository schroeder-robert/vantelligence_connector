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

    this.poll(connection.interval || 10000, async () => {
      for (let i in values) {
        const value = values[i]
        const range = value.max - value.min
        const raw = await this.sensor.measure(value.measure)
        const result = Math.max(value.min, Math.min(value.max, raw > 32768 ? raw - 65536 : raw))
      
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
