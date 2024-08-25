import bus from 'i2c-bus'
import display from 'oled-i2c-bus'
import Device from './base.js'
import font from 'oled-font-5x7'

export default class extends Device {
  constructor (config) {
    super(config)
    
    this.manufacturer = '?'
    this.model = 'OLED'
    this.version = '1'
    this.bus = null
  }

  async connect () {
    const { interval } = this.config

    const i2cBus = bus.openSync(1)

    var oled = new display(i2cBus, {
      width: 128,
      height: 64,
      address: 0x3C
    })

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
}