import bus from 'i2c-bus'
import PCA9685 from 'pca9685'
import Device from './base.js'

const ADDRESS = 0x40

export default class extends Device {
  constructor (config) {
    super(config)
    
    this.manufacturer = '...'
    this.model = 'PCA9685'
    this.version = '1'
    this.controller = null
  }

  async connect () {
    const config = this.config.connection

    try {
      let options = {
        i2c: bus.openSync(config.bus),
        address: ADDRESS,
        frequency: 50,
        debug: false
      }

      this.controller = new PCA9685.Pca9685Driver(options, error => {
        if (!error) {
          if (this.config.channels) {
            this.config.channels.forEach(channel => {
              this.emitEntity({
                type: 'light',
                name: channel.name,
                key: 'channel' + channel.id,
                brightness: true,
                brightnessScale: channel.max - channel.min,
                commands: ['command'],
                states: {
                  state: JSON.stringify({
                    state: 'ON',
                    brightness: 100
                  })
                }
              })
            })
          }

          // pwm.channelOff,(0)

          // pwm.setDutyCycle(0, 1)

          // controller.setPulseLength(0, 400) // 364
          // controller.setPulseLength(0, 2600) // 2736

          // pwm.setPulseRange(0, 10, 240, function() {
          //   if (error) {
          //     console.error("Error setting pulse range.")
          //   } else {
          //     console.log("Pulse range set.")
          //   }
          // })
        }
      })
    } catch (error) {
      return 'PCA9685 initialization failed: ' + error
    }
  }

  async handle (key, state, value) {
    const id = parseInt(key.slice(7))
    const channel = this.config.channels.find(channel => channel.id === id)

    if (channel) {
      value = JSON.parse(value)

      this.controller.setPulseLength(id, value.brightness + channel.min)
    }
  }
}
