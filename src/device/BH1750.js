import bus from 'i2c-bus'
import base from './base.js'

export const info = {
  manufacturer: 'ROHM Semiconductor',
  model: 'BH1750',
  version: '1'
}

export const device = class extends base {
  constructor (config) {
    super(info, config)
    
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