import i2c from 'i2c-bus'
import display from 'oled-i2c-bus'
import fonts from 'oled-font-pack'

const all = [
  'oled_3x5',
  'tiny_4x6',
  'oled_5x7',
  'small_6x8',
  'sinclair_8x8',
  'sinclair_inverted_8x8',
  'tiny_8x8',
  'cp437_8x8',
  'myke2_8x9',
  'small_8x12',
  'tron_8x12',
  'retro_8x16',
  'medium_numbers_12x16',
  'big_numbers_14x24',
  'arial_bold_16x16',
  'arial_italic_16x16',
  'arial_normal_16x16',
  'big_16x16',
  'franklin_gothic_normal_16x16',
  'hallfetica_normal_16x16',
  'nadianne_16x16',
  'sinclair_medium_16x16',
  'sinclair_medium_inverted_16x16',
  'swiss_721_outline_16x16',
  'various_symbols_16x16',
  'dot_matrix_medium_16x22',
  'dot_matrix_medium_zero_slash_16x22',
  'dot_matrix_medium_numbers_only_16x22',
  'arial_round_16x24',
  'ocr_a_extended_medium_16x24',
  'sixteen_segment_16x24',
  'grotesk_16x32',
  'grotesk_bold_16x32',
  'retro_16x32',
  'various_symbols_16x32',
  'various_symbols_v2_16x32',
  'dot_matrix_large_numbers_only_24x29',
  'inconsola_24x32',
  'ubuntu_24x32',
  'ubuntu_bold_24x32',
  'dingbats1_extra_large_32x24',
  'various_symbols_32x32'
]

export default ({ device, prop, stateValues }) => {
  const connection = prop('connection', { bus: 1, address: 0x3C })
  const bus = i2c.openSync(connection.bus)
  const oled = new display(bus, { width: 128, height: 64, address: connection.address })
  let index = 0

  const dev = device('OLED', 'OLED')

  const power = dev.switch('power', 'Power')

  power.command(v => {
    if (v === stateValues.on) {
      oled.turnOnDisplay()
    } else {
      oled.turnOffDisplay()
    }

    power.state(v)
  })

  const text = dev.text('content', 'Inhalt')

  text.command(v => {
    write(oled, v)

    text.state(v)
  })

  // setInterval(() => {
  //   write(oled, all[index++])
  // }, 1000)
}

function write (oled, font) {

  oled.clearDisplay()
  oled.dimDisplay(false)

  // oled.drawPixel([
  //   [128, 1, 1],
  //   [128, 32, 1],
  //   [128, 16, 1],
  //   [64, 16, 1]
  // ])

  // oled.drawLine(1, 32, 128, 32, 10)

  // oled.fillRect(0, 0, 128, 64, 1)

  oled.setCursor(1, 1)
  oled.writeString(fonts['ubuntu_24x32'], 1, font, 1, true)



  oled.invertDisplay(false)

  
}