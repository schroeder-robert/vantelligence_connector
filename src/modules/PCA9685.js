import i2c from 'i2c-bus'
import PCA9685 from 'pca9685'

export default async ({ device, prop, stateValues, log, logError }) => {
  const dev = device('NXP', 'PCA9685', '1')
  const connection = prop('connection', { bus: 1, address: 0x40 })
  const channels = prop('channels', {})
  const collection = Array.from({ length: 16 }).map((v, i) => {
    const channel = channels.find(c => i === c.id) || {}
    const data = { id: i }
    const id = 'channel' + i
    const name = channel.name || 'Channel #' + i

    if (channel.type === 'light') {
      data.scale = channel.scale || 1
      data.entity = dev.light(id, name, data.scale > 1 ? { brightness: true, brightnessScale: data.scale } : { brightness: false })
    } else {
      data.min = channel.min || 0
      data.max = channel.max || 2600
      data.scale = channel.scale || data.max
      data.entity = dev.number(id, name, { min: 0, max: data.scale })
    }

    return data
  })

  try {
    const controller = await (() => new Promise((resolve, reject) => {
      const driver = new PCA9685.Pca9685Driver({
        i2c: i2c.openSync(connection.bus),
        address: connection.address,
        frequency: 120,
        debug: false
      }, error => error ? reject(error) : resolve(driver))
    }))()

    collection.forEach(({ id, min, max, scale, entity }) => {
      if (entity.get('type') === 'light') {
        entity.command(value => {
          value = JSON.parse(value)

          if (value.state === stateValues.off) {
            controller.setDutyCycle(id, 0)
            entity.state({ state: stateValues.off })
          } else if (scale > 1) {
            const brightness = value.brightness || scale

            controller.setDutyCycle(id, brightness / scale)
            entity.state({ state: stateValues.on, brightness })
          } else {
            controller.setDutyCycle(id, 1)
            entity.state({ state: stateValues.on })
          }
        })
      } else {
        entity.command(value => {
          controller.setPulseLength(id, Math.round(value / scale * (max - min) + min))
          entity.state(value)
        })
      }
    })
  } catch (error) {
    logError(error)
  }
}
