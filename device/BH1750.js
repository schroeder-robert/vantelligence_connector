import bus from 'i2c-bus'
import Device from './base.js'

export default class extends Device {
  constructor (config) {
    super(config)
    
    this.manufacturer = 'ROHM Semiconductor'
    this.model = 'BH1750'
    this.version = '1'
    this.bus = null
  }

  async connect () {
    const { connection } = this.config

    this.bus = bus.openSync(parseInt(connection.bus))

    this.poll(1000, () => {
      const buffer = Buffer.alloc(2)
      
      this.bus.readI2cBlockSync(connection.address || 0x23, 0x10, buffer.length, buffer)

      this.processMessage(buffer)
    })
  }

  disconnect () {
    this.bus.closeSync()
  }

  processMessage (buffer) {
    if (buffer.length < 1) return

    const illuminance = Math.round(buffer.readInt16BE(0) / 1.2)

    this.emitEntity({
      name: 'Helligkeit',
      key: 'illuminance',
      class: 'illuminance',
      unit: 'lx',
      states: {
        state: illuminance,
      }
    })
  }
}