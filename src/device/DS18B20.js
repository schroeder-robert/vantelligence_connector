import sensor from 'ds18b20-raspi'
import base from './base.js'

export const info = {
  manufacturer: 'Dallas',
  model: 'DS18B20',
  version: '1'
}

export const device = class extends base {
  constructor (config) {
    super(info, config)
  }

  async connect () {
    const { interval } = this.config

    this.poll(interval, async () => {
      this.emitEntity({
        name: 'Temperatur',
        key: 'temperature',
        class: 'temperature',
        unit: '°C',
        states: {
          state: sensor.readSimpleC()?.toFixed(1) || 0
        }
      })
    })
  }
}