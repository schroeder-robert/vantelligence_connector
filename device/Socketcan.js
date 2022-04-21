import can from 'socketcan'
import Device from './base.js'

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

      if (type === 'out') {
        INSTANCES[key] = new Gpio(pin.id, { mode: Gpio.OUTPUT, alert: true })
        INSTANCES[key].on('alert', emit)
        INSTANCES[key].digitalWrite(pin.inverted ? 1 : 0)

        entity.commands = ['command']

        emit(pin.inverted ? 1 : 0)
      }

      if (type === 'pwm') {
        INSTANCES[key] = new Gpio(pin.id, { mode: Gpio.OUTPUT, alert: true })

        entity.commands = ['command']

        this.emitEntity(entity)
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
      INSTANCES[key].digitalWrite((value === 'ON' && !pin.inverted) || (value !== 'ON' && pin.inverted) ? 1 : 0)
    }
  }

  disconnect () {

  }
}