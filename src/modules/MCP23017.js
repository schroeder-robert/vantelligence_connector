import i2c from 'i2c-bus'
import { MCP23017 } from 'i2c-io-expanders'

export default async ({ device, poll, prop, restart, stateValues, log, logError }) => {
  const dev = device('Microchip', 'MCP23017', '1')
  const connection = prop('connection', { bus: 1, address: 0x20 })
  const pins = prop('pins')
  const bus = i2c.openSync(connection.bus)
  const mcp = new MCP23017(bus, connection.address)
  const entities = {}

  process.on('SIGINT', async () => {
    await mcp.close()
    bus.closeSync()
  })

  try {
    await mcp.initialize(false)
  } catch (error) {
    logError(error)

    return restart()
  }

  for (const pin of pins) {
    const key = pin.key || 'pin_' + pin.id

    if (pin.type === 'in') {
      await mcp.inputPin(pin.id, !!pin.inverted)

      entities[pin.id] = dev.binarySensor(key, pin.name)
      entities[pin.id].state(await mcp.getPinValue(pin.id) ? stateValues.on : stateValues.off)
    }

    if (pin.type === 'out') {
      await mcp.outputPin(pin.id, !!pin.inverted, !!pin.active)

      entities[pin.id] = dev.switch(key, pin.name)
      entities[pin.id].state(stateValues.off)
      entities[pin.id].command(value => {
        const to = ((value === stateValues.on && !pin.inverted) || (value !== stateValues.on && pin.inverted)) ? true : false

        mcp.setPin(pin.id, to)
        entities[pin.id].state(to ? stateValues.on : stateValues.off)
      })
    }
  }

  mcp.on('input', event => entities[event.pin].state(event.value))

  poll(50, () => mcp.doPoll())
}