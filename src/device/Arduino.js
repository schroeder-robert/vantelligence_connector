import i2c from 'i2c-bus'
import Device from './base.js'

const ADDRESS = 0x08
const BRIGHTNESS_SCALE = 255

export default class extends Device {
  constructor (config) {
    super(config)
    
    this.manufacturer = 'Arduino'
    this.model = 'Light Controller'
    this.version = '1'
    this.bus = null
  }

  async connect () {
    const { connection } = this.config
    
    this.bus = i2c.openSync(parseInt(connection.bus))
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