import bus from 'i2c-bus'
import PCA9685 from 'pca9685'
import Device from './base.js'

const ADDRESS = 0x40

export default class extends Device {
  constructor (config) {
    super(config)
    
    this.manufacturer = 'NXP'
    this.model = 'PCA9685'
    this.version = '1'
    this.controller = null
  }

  async connect () {
    const { connection, channels } = this.config

    try {
      let options = {
        i2c: bus.openSync(connection.bus),
        address: ADDRESS,
        frequency: 50,
        debug: false
      }

      this.controller = new PCA9685.Pca9685Driver(options, error => {
        if (!error) {
          if (channels) {
            channels.forEach(channel => this.emitChannel(channel, 0))
          }
        }
      })
    } catch (error) {
      return 'PCA9685 initialization failed: ' + error
    }
  }

  emitChannel (channel, state) {
    this.emitEntity({
      type: 'number',
      name: channel.name,
      key: 'channel' + channel.id,
      min: 0,
      max: channel.scale || 180,
      commands: ['command'],
      states: { state }
    })
  }

  async handle (key, state, value) {
    const id = parseInt(key.slice(7))
    const channel = this.config.channels.find(channel => channel.id === id)

    if (channel) {
      this.controller.setPulseLength(id, Math.round(value / (channel.scale || 180) * (channel.max - channel.min) + channel.min))

      this.emitChannel(channel, value)
    }
  }
}
