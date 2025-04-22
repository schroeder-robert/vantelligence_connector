import sensor from 'ds18b20-raspi'

export default ({ device, poll, prop }) => {
  const dev = device('Dallas', 'DS18B20', '1')
  const temperature = dev.sensor('temperature', 'Temperatur')

  poll(prop('interval', 10000), () => {
    const v = sensor.readSimpleC()?.toFixed(1)
    
    temperature.state(v || 0)
  })
}