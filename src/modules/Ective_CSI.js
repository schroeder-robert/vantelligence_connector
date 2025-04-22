import { pigpio } from 'pigpio-client'

const MODE_OPTIONS = [
  'ECO',
  'USP'
]

let POWER_PIN = null
let MODE_PIN = null
let DATA_PIN = null

export default ({ device, poll, config }) => {
  const dev = device('Ective', 'CSI', '1')
}

export const device = class extends base {
  constructor (config) {
    super(info, config)
    
    this.buffer = []
    this.timeout = null
    this.port = null
  }

  async connect () {
    const client = pigpio({ host: 'localhost' })
    const ready = new Promise((resolve, reject) => {
      client.once('connected', resolve)
      client.once('error', reject)
    })

    ready.then(async (info) => {
      const { connection } = this.config

      if (connection.type === 'pins') {
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

        POWER_PIN = client.gpio(connection.power_pin)
        POWER_PIN.modeSet('output')
        POWER_PIN.notify(emitPower)
        POWER_PIN.write(0)

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

        MODE_PIN = client.gpio(connection.mode_pin)
        MODE_PIN.modeSet('output')
        MODE_PIN.notify(emitMode)
        MODE_PIN.write(0)

        emitMode(0)

        let last = 0
        let data = []

        DATA_PIN = client.gpio(connection.data_pin)
        DATA_PIN.modeSet('input')
        
          //edge: Gpio.RISING_EDGE

        DATA_PIN.pullUpDown(2)
        DATA_PIN.glitchSet(10000)
        DATA_PIN.notify((state, tick) => {
          if (state) {
            const value = tick - last
            // console.log(value, state)
            if (value > 90000) {
              if (data.length) {
                this.processMessage(data)
              }

              data = []
            } else {
              data.push(value < 70000)
            }

            last = tick
          }
        })
      } else {
        return 'Unknown connection type!'
      }
    }).catch(console.error)
  }

  setPower (state) {
    POWER_PIN.write(state === 'ON' ? 1 : 0)
  }

  setMode (state) {
    MODE_PIN.write(parseInt(state))
  }

  processMessage (data) {
    if (!data || !data.length) {
      return
    }

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
      name: 'Bypass',
      key: 'bypass',
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
      name: 'AC Charge',
      key: 'ac_charge',
      states: {
        state: data[3] ? 'ON' : 'OFF'
      }
    })

    this.emitEntity({
      type: 'binary_sensor',
      name: 'AC In',
      key: 'ac_in',
      states: {
        state: data[4] ? 'ON' : 'OFF'
      }
    })

    this.emitEntity({
      type: 'binary_sensor',
      name: 'Fault',
      key: 'fault',
      states: {
        state: data[5] ? 'ON' : 'OFF'
      }
    })

    this.emitEntity({
      type: 'binary_sensor',
      name: 'Solar Charge',
      key: 'solar_charge',
      states: {
        state: data[6] ? 'ON' : 'OFF'
      }
    })

    this.emitEntity({
      type: 'binary_sensor',
      name: 'Error 2',
      key: 'error_2',
      states: {
        state: data[7] ? 'ON' : 'OFF'
      }
    })
  }
}