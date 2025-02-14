import i2c from 'i2c-bus'
import { MCP23017 } from 'i2c-io-expanders'
import Device from './base.js'

export default class extends Device {
  constructor (config) {
    super(config)
    
    this.manufacturer = 'Microchip'
    this.model = 'MCP23017'
    this.version = '1'
    this.mcp = null
  }

  async connect () {
    const { connection, pins } = this.config
    const bus = i2c.openSync(connection.bus)
    
    this.mcp = new MCP23017(bus, connection.address || 0x20)
    
    process.on('SIGINT', async () => {
      await this.mcp.close()
      bus.closeSync()
    })

    try {
      await this.mcp.initialize(false)
    } catch (error) {
      this.restart()

      throw error
    }

    this.mcp.on('input', event => {
      this.emitSensor(pins[event.pin], event.value)
    })

    for (const p in pins) {
      const pin = pins[p]

      if (pin.type === 'in') {
        await this.mcp.inputPin(pin.id, !!pin.inverted)

        this.emitSensor(pin, await this.mcp.getPinValue(pin.id))
      }

      if (pin.type === 'out') {
        await this.mcp.outputPin(pin.id, !!pin.inverted, !!pin.active)

        this.emitSwitch(pin, false)
      }
    }

    this.poll(50, () => this.mcp.doPoll())
  }

  restart () {
    setTimeout(() => this.connect(), 3000)
  }
  
  emitSensor (pin, state) {
    this.emit(pin, state, {
      type: 'binary_sensor'
    })
  }
  
  emitSwitch (pin, state) {
    this.emit(pin, state, {
      type: 'switch',
      commands: ['command']
    })
  }

  emit (pin, state, entity) {
    this.emitEntity({
      name: pin.name,
      key: pin.key || 'pin_' + pin.id,
      states: {
        state: state ? this.STATE.on : this.STATE.off
      },
      ...entity
    })
  }

  async handle (key, state, value) {
    // const id = parseInt(key.split('_')[1])
    // const pin = this.config.pins.find(pin => pin.id == id)
    const pin = this.config.pins.find(pin => pin.key == key)
    const to = ((value === this.STATE.on && !pin.inverted) || (value !== this.STATE.on && pin.inverted)) ? true : false

    if (pin) {
      this.mcp.setPin(pin.id, to)
      this.emitSwitch(pin, to)
    }
  }
}