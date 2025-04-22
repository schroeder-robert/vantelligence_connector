import i2c from 'i2c-bus'

const BRIGHTNESS_SCALE = 255

export default ({ device, poll, prop, stateValues, log, logError }) => {
  const dev = device('MadeByRob', 'Arduino Light Controller', '1')
  const connection = prop('connection', { bus: 1, address: 0x08 })
  const names = prop('names', [])
  const bus = i2c.openSync(parseInt(connection.bus))
  const entities = []
  
  for (let i = 0; i < 12; ++i) {
    const brightness = i > 5
    const entity = dev.light('light' + i, names[i] || 'Light #' + i, {
      brightness,
      brightnessScale: brightness ? BRIGHTNESS_SCALE : undefined,
    })

    entity.command(value => {
      try {
        value = JSON.parse(value)

        if (i > 5 && value.state === stateValues.on && !('brightness' in value)) {
          value.brightness = BRIGHTNESS_SCALE
        }
  
        bus.writeByteSync(connection.address, i, value.state === stateValues.on ? value.brightness || 1 : 0)
        
        entity.state(value)
      } catch (error) {
        logError(error)
      }
    })

    entities.push(entity)
  }
  
  poll(10000, () => {
    entities.forEach((entity, i) => {
      try {
        const value = bus.readByteSync(connection.address, i)
        
        entity.state({
          state: value === 0 ? stateValues.off : stateValues.on,
          ...(entity.get('brightness') && { brightness: value })
        })
      } catch (error) {
        logError(error)
      }
    })
  })
}