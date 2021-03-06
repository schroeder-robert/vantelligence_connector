import bus from 'i2c-bus'
import Device from './base.js'

const ADDRESS = 0x23

export default class extends Device {
  constructor (config) {
    super(config)
    
    this.manufacturer = 'ROHM Semiconductor'
    this.model = 'BH1750'
    this.version = '1'
    this.bus = null
  }

  async connect () {
    const config = this.config.connection

    this.bus = bus.openSync(parseInt(config.bus))

    this.poll('requestValues', 1000, result => this.processMessage(result))
  }

  disconnect () {
    this.bus.closeSync()
  }

  decodeBytes (buffer) {
    const values = []

    for (let i = 0; i < buffer.length; i += 2) {
      const value = (buffer[i] << 8) | buffer[i + 1]

      values.push(value < 0x8000 ? value : value - 0x10000)
    }

    return values
  }

  requestValues () {
    const buffer = Buffer.alloc(2)
    
    this.bus.readI2cBlockSync(ADDRESS, 0x10, buffer.length, buffer)

    return buffer
  }

  processMessage (buffer) {
    const values = this.decodeBytes(buffer)
    const lux = Math.round(values[0] / 1.2)
    
    this.emitEntity({
      name: 'Helligkeit',
      key: 'illuminance',
      class: 'illuminance',
      unit: 'lx',
      states: {
        state: lux,
      }
    })
  }
}