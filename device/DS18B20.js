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
      const temps = sensor.readAllC(1);
      temps.map(({ id, t }) => {
        this.emitEntity({
          name: 'Temperatur',
          key: id,
          class: 'temperature',
          unit: '°C',
          states: {
            state: t || 0
          }
        })
      })
    })
  }
}
