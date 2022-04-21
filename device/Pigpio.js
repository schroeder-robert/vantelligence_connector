import { Gpio } from 'pigpio'
import Device from './base.js'

const LIGHT_BRIGHTNESS_SCALE = 255
let INSTANCES = {}

export default class extends Device {
  constructor (config) {
    super(config)

    this.manufacturer = 'Raspberry Pi'
    this.model = 'GPIO'
    this.version = '1'
  }

  async connect () {
    this.config.pins.forEach(pin => {
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
      const emitLight = state => {
        entity.brightness = true
        entity.brightnessScale = LIGHT_BRIGHTNESS_SCALE
        entity.states = {
          state: state ? '{"state": "ON", "brightness": ' + state + '}' : '{"state": "OFF"}'
        }

        this.emitEntity(entity)
      }

      if (type === 'out') {
        INSTANCES[key] = new Gpio(pin.id, { mode: Gpio.OUTPUT, alert: true })
        INSTANCES[key].on('alert', emit)
        INSTANCES[key].digitalWrite(pin.inverted ? 1 : 0)

        entity.commands = ['command']

        emit(pin.inverted ? 1 : 0)
      }

      if (type === 'pwm') {
        INSTANCES[key] = new Gpio(pin.id, { mode: Gpio.OUTPUT, alert: true })
        INSTANCES[key].pwmWrite(0)
        INSTANCES[key].on('pwm_change', () => emitLight(INSTANCES[key].getPwmDutyCycle()))

        entity.commands = ['command']
        
        emitLight(0)
      }

      if (type === 'in') {
        INSTANCES[key] = new Gpio(pin.id, { mode: Gpio.INPUT, alert: true })
        INSTANCES[key].on('alert', emit)
        INSTANCES[key].glitchFilter(pin.debounce || 50000)

        emit(INSTANCES[key].digitalRead())
      }
    })
  }

  async handle (key, state, value) {
    const id = parseInt(key.split('_')[1])
    const pin = this.config.pins.find(pin => pin.id == id)
    
    if (INSTANCES[key] && pin) {
      if (pin.type === 'pwm') {
        value = JSON.parse(value)
        console.log(value)
        INSTANCES[key].pwmWrite(value.state === 'ON' ? value.brightness || LIGHT_BRIGHTNESS_SCALE : 0)
        INSTANCES[key].emit('pwm_change')
      } else {
        INSTANCES[key].digitalWrite((value === 'ON' && !pin.inverted) || (value !== 'ON' && pin.inverted) ? 1 : 0)
      }
    }
  }

  disconnect () {

  }
}