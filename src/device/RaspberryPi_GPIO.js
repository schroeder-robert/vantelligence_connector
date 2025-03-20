import rpio from 'rpio'
import base from './base.js'

export const info = {
  manufacturer: 'Raspberry Pi',
  model: 'GPIO',
  version: '2'
}

export const device = class extends base {
  constructor (config) {
    super(info, config)
  }

  async connect () {
    const { pins } = this.config

    rpio.init({
      gpiomem: false
    })

    pins.forEach(pin => {
      const entity = {
        name: pin.name,
        key: pin.key || 'pin_' + pin.id
      }
      const emit = pin => {
        const state = rpio.read(pin.id)

        entity.states = {
          state: (state === 1 && !pin.inverted) || (state !== 1 && pin.inverted) ? this.STATE.on : this.STATE.off
        }

        this.emitEntity(entity)
      }

      if (pin.type === 'in') {
        entity.type = 'binary_sensor'

        rpio.open(pin.id, rpio.INPUT, pin.pull === 'up' ? rpio.PULL_UP : (pin.pull === 'down' ? rpio.PULL_DOWN : rpio.PULL_OFF))
        rpio.poll(pin.id, () => emit(pin))
        
        emit(pin)
      }

      if (pin.type === 'out') {
        entity.type = 'switch'
        entity.commands = ['command']

        rpio.open(pin.id, rpio.OUTPUT)
        rpio.poll(pin.id, () => emit(pin))

        emit(pin)
      }
    })
  }

  async handle (key, state, value) {
    const id = parseInt(key.split('_')[1])
    const pin = this.config.pins.find(pin => pin.id == id)
    
    if (pin) {
      rpio.write(id, (value === 'ON' && !pin.inverted) || (value !== 'ON' && pin.inverted) ? rpio.HIGH : rpio.LOW)
    }
  }
}