import rpio from 'rpio'
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
    const { pins } = this.config

    rpio.init({
      gpiomem: false
    })

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

      if (pin.type === 'out') {
        rpio.open(pin.id, rpio.OUTPUT)
        rpio.poll(pin.id, () => emit(rpio.read(pin.id)))

        entity.commands = ['command']

        emit(rpio.read(pin.id))
      } else if (pin.type === 'in') {
        rpio.open(pin.id, rpio.INPUT, pin.pull === 'up' ? rpio.PULL_UP : (pin.pull === 'down' ? rpio.PULL_DOWN : rpio.PULL_OFF))
        rpio.poll(pin.id, () => emitInput(rpio.read(pin.id)))
        
        this.emitInput(rpio.read(pin.id))
      } else if (pin.type === 'pwm') {
        rpio.open(pin.id, rpio.PWM)
        // rpio.pwmSetClockDivider(4096)
        // rpio.pwmSetRange(pin.id, 1024)
        // rpio.pwmSetData(pin.id, 2)

        entity.commands = ['command']

        emit(rpio.read(pin.id))
      }
    })
  }

  emitInput () {
    this.emitEntity({

    })
  }

  // async connect () {
  //   const { connection, pins } = this.config
  //   const client = pigpio({
  //     host: connection.host
  //   })
  //   const ready = new Promise((resolve, reject) => {
  //     client.once('connected', resolve)
  //     client.once('error', reject)
  //   })

  //   ready.then(async (info) => {
  //     pins.forEach(pin => {
  //       const key = 'pin_' + pin.id
  //       const type = pin.type || 'in'
  //       const entityTypes = {
  //         in: 'binary_sensor',
  //         out: 'switch',
  //         pwm: 'light'
  //       }
  //       const entity = {
  //         name: pin.name,
  //         key,
  //         type: entityTypes[type]
  //       }
  //       const emit = state => {
  //         entity.states = {
  //           state: (state === 1 && !pin.inverted) || (state !== 1 && pin.inverted) ? 'ON' : 'OFF'
  //         }

  //         this.emitEntity(entity)
  //       }


  //       if (type === 'pwm') {
  //         INSTANCES[key] = client.gpio(pin.id)
  //         INSTANCES[key].modeSet('output')
  //         INSTANCES[key].analogWrite(0)
  //         INSTANCES[key].emit = state => {
  //           if (state.brightness === undefined) {
  //             state.brightness = LIGHT_BRIGHTNESS_SCALE
  //           }

  //           entity.brightness = true
  //           entity.brightnessScale = LIGHT_BRIGHTNESS_SCALE
  //           entity.states = {
  //             state: JSON.stringify(state)
  //           }
  
  //           this.emitEntity(entity)
  //         }

  //         entity.commands = ['command']
          
  //         INSTANCES[key].emit({ state: 'OFF' })
  //       }

  //     })
  //   }).catch(console.error)
  // }

  async handle (key, state, value) {
    const id = parseInt(key.split('_')[1])
    const pin = this.config.pins.find(pin => pin.id == id)
    
    if (pin) {
      if (pin.type === 'pwm') {
        // value = JSON.parse(value)

        // INSTANCES[key].analogWrite(value.state === 'ON' ? value.brightness || LIGHT_BRIGHTNESS_SCALE : 0)
        // INSTANCES[key].emit(value)
      } else {
        rpio.write(id, (value === 'ON' && !pin.inverted) || (value !== 'ON' && pin.inverted) ? rpio.HIGH : rpio.LOW)
      }
    }
  }

  // disconnect () {

  // }
}