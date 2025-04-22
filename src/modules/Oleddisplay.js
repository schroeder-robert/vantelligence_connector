import i2c from 'i2c-bus'
import display from 'oled-i2c-bus'
import font from 'oled-font-5x7'

export default ({ prop }) => {
  const connection = prop('connection', { bus: 1, address: 0x3C })
  const bus = i2c.openSync(connection.bus)
  const oled = new display(bus, { width: 128, height: 64, address: connection.address })

  oled.clearDisplay()

  oled.drawPixel([
    [128, 1, 1],
    [128, 32, 1],
    [128, 16, 1],
    [64, 16, 1]
  ])

  oled.drawLine(1, 32, 128, 64, 1)

  oled.fillRect(1, 40, 10, 20, 1)

  oled.setCursor(1, 1);
  oled.writeString(font, 4, '85%', 1, true);

  oled.invertDisplay(false)

  oled.dimDisplay(false)
}