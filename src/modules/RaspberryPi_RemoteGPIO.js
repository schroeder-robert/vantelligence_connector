import { pigpio } from 'pigpio-client'

const LIGHT_BRIGHTNESS_SCALE = 255
let INSTANCES = {}

export default ({ device, poll, config }) => {
  const dev = device('Raspberry Pi', 'RemoteGPIO', '2')
}

export const device = class extends base {
  constructor (config) {
    super(info, config)
  }

  async connect () {
    const { connection, pins } = this.config
    const client = pigpio({
      host: connection.host
    })
    const ready = new Promise((resolve, reject) => {
      client.once('connected', resolve)
      client.once('error', reject)
    })

    ready.then(async (info) => {
      pins.forEach(pin => {
        const key = 'pin_' + pin.id
        const type = pin.type || 'in'
        const entityTypes = {
          in: 'binary_sensor',
          out: 'switch',
          pwm: 'light'
        }
        const entity = {
          name: pin.name,
          key,
          type: entityTypes[type]
        }
        const emit = state => {
          entity.states = {
            state: (state === 1 && !pin.inverted) || (state !== 1 && pin.inverted) ? 'ON' : 'OFF'
          }

          this.emitEntity(entity)
        }

        if (type === 'out') {
          INSTANCES[key] = client.gpio(pin.id)
          INSTANCES[key].modeSet('output')
          INSTANCES[key].notify(emit)
          INSTANCES[key].write(pin.inverted ? 1 : 0)

          entity.commands = ['command']

          emit(pin.inverted ? 1 : 0)
        }

        if (type === 'pwm') {
          INSTANCES[key] = client.gpio(pin.id)
          INSTANCES[key].modeSet('output')
          INSTANCES[key].analogWrite(0)
          INSTANCES[key].emit = state => {
            if (state.brightness === undefined) {
              state.brightness = LIGHT_BRIGHTNESS_SCALE
            }

            entity.brightness = true
            entity.brightnessScale = LIGHT_BRIGHTNESS_SCALE
            entity.states = {
              state: JSON.stringify(state)
            }
  
            this.emitEntity(entity)
          }

          entity.commands = ['command']
          
          INSTANCES[key].emit({ state: 'OFF' })
        }

        if (type === 'in') {
          INSTANCES[key] = client.gpio(pin.id)
          INSTANCES[key].modeSet('input')
          INSTANCES[key].notify(emit)
          INSTANCES[key].glitchSet(pin.debounce || 50000)
          INSTANCES[key].pullUpDown(pin.pull === 'up' ? 2 : (pin.pull === 'down' ? 1 : 0))
          INSTANCES[key].read((error, state) => {
            if (error) {
              console.error(error)
            } else {
              emit(state)
            }
          })
        }
      })
    }).catch(console.error)
  }

  async handle (key, state, value) {
    const id = parseInt(key.split('_')[1])
    const pin = this.config.pins.find(pin => pin.id == id)
    
    if (INSTANCES[key] && pin) {
      if (pin.type === 'pwm') {
        value = JSON.parse(value)

        INSTANCES[key].analogWrite(value.state === 'ON' ? value.brightness || LIGHT_BRIGHTNESS_SCALE : 0)
        INSTANCES[key].emit(value)
      } else {
        INSTANCES[key].write((value === 'ON' && !pin.inverted) || (value !== 'ON' && pin.inverted) ? 1 : 0)
      }
    }
  }

  disconnect () {

  }
}