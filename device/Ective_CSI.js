import { Gpio } from 'pigpio'
import Device from './base.js'

const MODE_OPTIONS = [
  'ECO',
  'USP'
]

let POWER_PIN = null
let MODE_PIN = null
let DATA_PIN = null

export default class extends Device {
  constructor (config) {
    super(config)
    
    this.manufacturer = 'Ective'
    this.model = 'CSI'
    this.version = '1'
    this.buffer = []
    this.timeout = null
    this.port = null
  }

  async connect () {
    const config = this.config.connection

    if (config.type === 'pins') {
      const emitPower = state => {
        this.emitEntity({
          type: 'switch',
          name: 'Power',
          key: 'power',
          commands: ['command'],
          states: {
            state: state === 1 ? 'ON' : 'OFF'
          }
        })

        if (!state) {
          this.processMessage([false, false, false, false, false, false, false, false])
        }
      }

      POWER_PIN = new Gpio(config.power_pin, { mode: Gpio.OUTPUT, alert: true })
      POWER_PIN.on('alert', emitPower)
      POWER_PIN.digitalWrite(0)

      emitPower(0)

      const emitMode = state => {
        this.emitEntity({
          type: 'select',
          name: 'Modus',
          key: 'mode',
          options: MODE_OPTIONS,
          commands: ['command'],
          states: {
            state: MODE_OPTIONS[state]
          }
        })
      }

      MODE_PIN = new Gpio(config.mode_pin, { mode: Gpio.OUTPUT, alert: true })
      MODE_PIN.on('alert', emitMode)
      MODE_PIN.digitalWrite(0)

      emitMode(0)

      let last = 0
      let data = []

      DATA_PIN = new Gpio(config.data_pin, { 
        mode: Gpio.INPUT,
        edge: Gpio.RISING_EDGE,
        pullUpDown: Gpio.PUD_UP
      })
      DATA_PIN.glitchFilter(10000)
      DATA_PIN.on('interrupt', (state, tick) => {
        const value = tick - last

        if (value > 90000) {
          if (data.length) {
            this.processMessage(data)
          }

          data = []
        } else {
          data.push(value < 70000)
        }

        last = tick
      })
    } else {
      return 'Unknown connection type!'
    }
  }

  setPower (state) {
    POWER_PIN.digitalWrite(state === 'ON' ? 1 : 0)
  }

  setMode (state) {
    MODE_PIN.digitalWrite(state)
  }

  processMessage (data) {
    this.emitEntity({
      type: 'binary_sensor',
      name: 'Bit #1',
      key: 'bit_1',
      states: {
        state: data[0] ? 'ON' : 'OFF'
      }
    })

    this.emitEntity({
      type: 'binary_sensor',
      name: 'Bit #2',
      key: 'bit_2',
      states: {
        state: data[1] ? 'ON' : 'OFF'
      }
    })

    this.emitEntity({
      type: 'binary_sensor',
      name: 'Inverter',
      key: 'inverter',
      states: {
        state: data[2] ? 'ON' : 'OFF'
      }
    })

    this.emitEntity({
      type: 'binary_sensor',
      name: 'Bit #4',
      key: 'bit_4',
      states: {
        state: data[3] ? 'ON' : 'OFF'
      }
    })

    this.emitEntity({
      type: 'binary_sensor',
      name: 'Landstrom',
      key: 'landstrom',
      states: {
        state: data[4] ? 'ON' : 'OFF'
      }
    })

    this.emitEntity({
      type: 'binary_sensor',
      name: 'Bit #6',
      key: 'bit_6',
      states: {
        state: data[5] ? 'ON' : 'OFF'
      }
    })

    this.emitEntity({
      type: 'binary_sensor',
      name: 'Bit #7',
      key: 'bit_7',
      states: {
        state: data[6] ? 'ON' : 'OFF'
      }
    })

    this.emitEntity({
      type: 'binary_sensor',
      name: 'Bit #8',
      key: 'bit_8',
      states: {
        state: data[7] ? 'ON' : 'OFF'
      }
    })
  }
}