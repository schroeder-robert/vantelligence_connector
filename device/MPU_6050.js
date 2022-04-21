import bus from 'i2c-bus'
import Device from './base.js'

const ADDRESS = 0x68

export default class extends Device {
  constructor (config) {
    super(config)
    
    this.manufacturer = 'TDK InvenSense'
    this.model = 'MPU-6050'
    this.version = '1'
    this.bus = null
  }

  async connect () {
    const config = this.config.connection

    this.bus = bus.openSync(parseInt(config.bus))
    this.bus.writeByteSync(ADDRESS, 0x6B, 0x01)

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
    const buffer = Buffer.alloc(14)
      
    this.bus.readI2cBlockSync(ADDRESS, 0x3B, buffer.length, buffer)

    return buffer
  }

  processMessage (buffer) {
    const values = this.decodeBytes(buffer)
    const temperature = Math.round((values[3] + 12412) / 34) / 10
    const forceX = Math.round(values[0] / 1638.4) / 10
    const forceY = Math.round(values[1] / 1638.4) / 10
    const forceZ = Math.round(values[2] / 1638.4) / 10
    const rotationX = Math.round(values[4] / 13.1) / 10
    const rotationY = Math.round(values[5] / 13.1) / 10
    const rotationZ = Math.round(values[6] / 13.1) / 10
    const tiltX = Math.round(Math.atan(forceX / Math.sqrt(forceY * forceY + forceZ * forceZ)) * 10) / 10
    const tiltY = Math.round(Math.atan(forceY / Math.sqrt(forceX * forceX + forceZ * forceZ)) * 10) / 10

    this.emitEntity({
      name: 'Neigung X',
      key: 'tilt_x',
      unit: '°',
      states: {
        state: tiltX
      }
    })
    
    this.emitEntity({
      name: 'Neigung Y',
      key: 'tilt_y',
      unit: '°',
      states: {
        state: tiltY
      }
    })
    
    this.emitEntity({
      name: 'Temperatur',
      key: 'temperature',
      class: 'temperature',
      unit: '°C',
      states: {
        state: temperature
      }
    })
    
    this.emitEntity({
      name: 'G-Kraft X',
      key: 'force_x',
      unit: 'g',
      states: {
        state: forceX
      }
    })
    
    this.emitEntity({
      name: 'G-Kraft Y',
      key: 'force_y',
      unit: 'g',
      states: {
        state: forceY
      }
    })
    
    this.emitEntity({
      name: 'G-Kraft Z',
      key: 'force_z',
      unit: 'g',
      states: {
        state: forceZ
      }
    })
    
    this.emitEntity({
      name: 'Rotation X',
      key: 'rotation_x',
      unit: '°s',
      states: {
        state: rotationX
      }
    })
    
    this.emitEntity({
      name: 'Rotation Y',
      key: 'rotation_y',
      unit: '°s',
      states: {
        state: rotationY
      }
    })
    
    this.emitEntity({
      name: 'Rotation Z',
      key: 'rotation_z',
      unit: '°s',
      states: {
        state: rotationZ
      }
    })
  }
}