import i2c from 'i2c-bus'
import PCA9685 from 'pca9685'

const LIGHT_BRIGHTNESS_SCALE = 255

export default async ({ device, prop, stateValues, log, logError }) => {
  const dev = device('NXP', 'PCA9685', '1')
  const connection = prop('connection', { bus: 1, address: 0x40 })
  const channels = prop('channels', {})
  const collection = Array.from({ length: 16 }).map((v, i) => {
    const channel = channels.find(c => i === c.id) || {}
    const data = { id: i }
    const id = 'channel' + i
    const name = channel.name || 'Channel #' + channel.id

   if (channel.type === 'switch') {
      data.entity = dev.switch(id, name)
      data.entity.state(stateValues.off)
   } else if (channel.type === 'light') {
      data.entity = dev.light(id, name, { brightness: true, brightnessScale: LIGHT_BRIGHTNESS_SCALE })
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
        debug: true
      }, error => error ? reject(error) : resolve(driver))
    }))()

    collection.forEach(({ id, min, max, scale, entity }) => {
      if (entity.get('type') === 'switch') {
        entity.command(value => {
          controller.setDutyCycle(id, value === stateValues.on ? 1 : 0)
          entity.state(value)
        })
      } else if (entity.get('type') === 'light') {
        entity.command(value => {
          value = JSON.parse(value)
          
          if (!('brightness' in value)) {
            value.brightness = value.state === stateValues.on ? LIGHT_BRIGHTNESS_SCALE : 0
          }

          controller.setDutyCycle(id, value.brightness  / LIGHT_BRIGHTNESS_SCALE)
          entity.state(value)
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
