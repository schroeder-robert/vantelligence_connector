import sensor from 'ds18b20-raspi'
import Device from './base.js'

export default class extends Device {
  constructor (config) {
    super(config)
    
    this.manufacturer = '???'
    this.model = 'DS18B20'
    this.version = '1'
  }

  async connect () {
    this.poll(1000, async () => {
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