import sensor from 'ds18b20-raspi'
import Device from './base.js'

export default class extends Device {
  constructor (config) {
    super(config)
    
    this.manufacturer = 'Dallas'
    this.model = 'DS18B20'
    this.version = '1'
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