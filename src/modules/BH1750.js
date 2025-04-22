import i2c from 'i2c-bus'

export default ({ device, poll, prop }) => {
  const dev = device('ROHM Semiconductor', 'BH1750', '1')
  const illuminance = dev.sensor('illuminance', 'Helligkeit')
  const connection = prop('connection', { bus: 1, address: 0x23 })
  const bus = i2c.openSync(parseInt(connection.bus))

  poll(prop('interval', 10000), () => {
    const buffer = Buffer.alloc(2)

    bus.readI2cBlockSync(connection.address, 0x10, buffer.length, buffer)

    if (buffer.length > 0) {
      illuminance.state(Math.round(buffer.readInt16BE(0) / 1.2))
    }
  })
}