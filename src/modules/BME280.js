import BME280 from 'bme280-sensor'

export default async ({ device, poll, prop, entityUnits, log }) => {
  const dev = device('Bosch', 'BME280', '1')
  const temperature = dev.sensor('temperature', 'Temperatur')
  const humidity = dev.sensor('humidity', 'Feuchtigkeit', { unit: entityUnits.percent })
  const pressure = dev.sensor('pressure', 'Druck', { unit: entityUnits.hpa })
  const connection = prop('connection', { bus: 1, address: 0x76 })
  const sensor = new BME280({
    i2cBusNo: parseInt(connection.bus),
    i2cAddress: connection.address
  })

  await sensor.init()

  poll(prop('interval', 10000), async () => {
    const values = await sensor.readSensorData()

    if (values?.temperature_C) {
      temperature.state(Math.round(values.temperature_C * 10) / 10)
    }
    
    if (values?.humidity) {
      humidity.state(Math.round(values.humidity * 10) / 10)
    }
    
    if (values?.pressure_hPa) {
      pressure.state(Math.round(values.pressure_hPa * 10) / 10)
    }
  })
}