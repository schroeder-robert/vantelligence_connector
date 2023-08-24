import ADS1115 from 'ads1115'
import Device from './base.js'
import KalmanFilter from 'kalmanjs'

const ADDRESS = 0x48
const kf = new KalmanFilter({R: 0.01, Q: 3})

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
    const filters = []

    for (let value of values) {
      filters.push(value.filter ? new KalmanFilter({ R: 0.01, Q: 3 }) : null)
    }

    this.sensor = await ADS1115.open(parseInt(connection.bus), ADDRESS, 'i2c-bus')
    this.sensor.gain = 2
    
    this.poll(connection.interval || 10000, async () => {
      for (let i in values) {
        const value = values[i]
        const range = value.max - value.min
        let raw = await this.sensor.measure(value.measure)

        if (value.filter) {
          raw = filters[i].filter(raw).toFixed()
        }

        const result = Math.max(value.min, Math.min(value.max, raw > 32768 ? raw - 65536 : raw)) - value.min

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
