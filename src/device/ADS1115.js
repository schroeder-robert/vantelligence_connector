import ADS1115 from 'ads1115'
import base from './base.js'
import KalmanFilter from 'kalmanjs'

export const info = {
  manufacturer: 'Texas Instruments',
  model: 'ADS1115',
  version: '1'
}

export const device = class extends base {
  constructor (config) {
    super(info, config)
    
    this.sensor = null
  }

  async connect () {
    const { connection, interval, values } = this.config
    const filters = []

    for (let value of values) {
      filters.push(value.filter ? new KalmanFilter({ R: 0.01, Q: 3 }) : null)
    }

    this.sensor = await ADS1115.open(parseInt(connection.bus), connection.address || 0x48, 'i2c-bus')
    this.sensor.gain = 2
    
    this.poll(interval || 10000, async () => {
      for (let i in values) {
        const value = values[i]
        const zero = Math.max(value.min, Math.min(value.max, value.zero || value.min))

        try {
          let raw = await this.sensor.measure(value.measure)

          if (value.filter) {
            raw = filters[i].filter(raw).toFixed()
          }

          const positive = raw >= zero
          const range = positive ? value.max - zero : zero - value.min
          const result = (Math.max(value.min, Math.min(value.max, raw)) - zero) / range
          const entity = {
            name: value.name,
            key: this.convertNameToKey(value.name),
            unit: value.unit || '%',
            states: {
              state: Math.round(result * (value.scale || 100))
            }
          }

          if ('class' in value && value.class in this.CLASS) {
            entity.class = this.CLASS[value.class]
          }

          this.emitEntity(entity)
        } catch (error) {
          this.error(error.message)
        }
      }
    })
  }
}
