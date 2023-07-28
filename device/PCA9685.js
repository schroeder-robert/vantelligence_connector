import bus from 'i2c-bus'
import PCA9685 from 'pca9685'
import Device from './base.js'

const ADDRESS = 0x40
const LIGHT_BRIGHTNESS_SCALE = 255

export default class extends Device {
  constructor (config) {
    super(config)
    
    this.manufacturer = 'NXP'
    this.model = 'PCA9685'
    this.version = '1'
    this.controller = null
  }

  connect () {
    return new Promise(resolve => {
      const { connection, channels } = this.config

      try {
        let options = {
          i2c: bus.openSync(connection.bus),
          address: ADDRESS,
          frequency: 120,
          debug: false
        }
        
        this.controller = new PCA9685.Pca9685Driver(options, async error => {
          if (error) {
            resolve(error)
          } else { 
            if (channels) {
              channels.forEach(channel => this.emitChannel(channel))
            }

            resolve()
          }
        })
      } catch (error) {
        resolve('PCA9685 initialization failed: ' + error)
      }
    })
  }

  emitChannel (channel, state) {
    if (channel.type === 'light') {
      this.emitEntity({
        type: 'light',
        name: channel.name,
        key: 'channel' + channel.id,
        brightness: true,
        brightnessScale: LIGHT_BRIGHTNESS_SCALE,
        commands: ['command'],
        states: {
          state: state ? JSON.stringify(state) : '{ "state": "OFF" }'
        }
      })
    } else {
      this.emitEntity({
        type: 'number',
        name: channel.name,
        key: 'channel' + channel.id,
        min: 0,
        max: channel.scale || 180,
        commands: ['command'],
        states: {
          state: state || 0
        }
      })
    }
  }

  async handle (key, state, value) {
    const id = parseInt(key.slice(7))
    const channel = this.config.channels.find(channel => channel.id === id)

    if (channel) {
      if (channel.type === 'light') {
        value = JSON.parse(value)

        this.controller.setDutyCycle(id, value.state === 'ON' ? (value.brightness ? value.brightness / LIGHT_BRIGHTNESS_SCALE : LIGHT_BRIGHTNESS_SCALE) : 0)
      } else {
        this.controller.setPulseLength(id, Math.round(value / (channel.scale || 180) * (channel.max - channel.min) + channel.min))
      }

      this.emitChannel(channel, value)
    }
  }
}
