import ADS1115 from 'ads1115'
import KalmanFilter from 'kalmanjs'

export default async ({ device, poll, prop, entityClasses, log, logError }) => {
  const dev = device('Texas Instruments', 'ADS1115', '1')
  const connection = prop('connection', { bus: 1, address: 0x48 })
  const values = prop('values', [])
  const sensor = await ADS1115.open(parseInt(connection.bus), connection.address, 'i2c-bus')
  const store = []

  // sensor.gain = 1

  for (let i = 0; i < 4; ++i) {
    const value = values[i] || {}
    const attributes = { unit: value.unit || '%' }
    const data = {}

    if ('class' in value && value.class in entityClasses) {
      attributes.class = entityClasses[value.class]
    }

    data.min = value.min || 0
    data.max = value.max || 65535
    data.scale = value.scale || 65535
    data.zero = Math.max(data.min, Math.min(data.max, value.zero || data.min))
    data.positive = data.max - data.zero
    data.negative = data.zero - data.min
    data.entity = dev.sensor('value' + i, value.name || 'Axxx' + i, attributes)
    data.filter = value.filter ? new KalmanFilter({ R: 0.01, Q: 3 }) : null
    
    store.push(data)
  }
    
  poll(prop('interval', 1000), async () => {
    try {
      for (let i in store) {
        const data = store[i]
        
        let raw = await sensor.measure(i + '+GND')
// log(i + '+GND', raw)
        if (data.filter) raw = data.filter.filter(raw).toFixed()
        
        const negative = raw < data.zero
        let result = (Math.max(data.min, Math.min(data.max, raw)) - data.zero) / (negative ? data.negative : data.positive)

        if (negative) result = -1 - result

        data.entity.state(Math.round(result * data.scale))
      }
    } catch (error) {
      logError(error.message)
    }
  })
}