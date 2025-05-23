import i2c from 'i2c-bus'
import base from './base.js'

const ADDRESS = 0x08
const BRIGHTNESS_SCALE = 255

export const info = {
  manufacturer: 'MadeByRob',
  model: 'Arduino Light Controller',
  version: '1'
}

export const device = class extends base {
  constructor (config) {
    super(info, config)
    
    this.bus = null
  }

  async connect () {
    const { connection } = this.config
    
    this.bus = i2c.openSync(parseInt(connection.bus))

    // this.poll(1000, () => {
    //   this.bus.writeByteSync(ADDRESS, 0, 1)
      
    //   console.log('LI', this.bus.readByteSync(ADDRESS, 0))
    // })

    this.poll(10000, () => Array.from({ length: 12 }).forEach((v, i) => this.emit(i)))
  }

  emit (i) {
    const light = this.config.lights[i] || {}
    const brightness = light.brightness
    let value

    try {
      value = this.bus.readByteSync(ADDRESS, i)
      
      this.emitEntity({
        type: 'light',
        key: 'light' + i,
        name: light.name || 'Light #' + i,
        brightness,
        brightnessScale: brightness ? BRIGHTNESS_SCALE : undefined,
        commands: [ 'command' ],
        states: {
          state: JSON.stringify({
            state: value === 0 ? 'OFF' : 'ON',
            ...(brightness && { brightness: value })
          })
        }
      })
    } catch (error) {
      this.error(error)
    }
  }

  handle (key, command, value) {
    const id = parseInt(key.slice(5))
    
    value = JSON.parse(value)

    if (id > 5 && value.state === 'ON' && !('brightness' in value)) {
      value.brightness = BRIGHTNESS_SCALE
    }

    this.bus.writeByteSync(ADDRESS, id, value.state === 'ON' ? value.brightness || 1 : 0)
    this.emit(id)
  }
}