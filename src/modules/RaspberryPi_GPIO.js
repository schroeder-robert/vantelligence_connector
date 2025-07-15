import rpio from 'rpio'

export default ({ device, prop, stateValues, log, logError }) => {
  const dev = device('Raspberry Pi', 'GPIO', '2')
  const pins = prop('pins')

  try {
    rpio.init({ gpiomem: true })

    pins.forEach(pin => {
      const on = pin.inverted ? rpio.LOW : rpio.HIGH
      const off = pin.inverted ? rpio.HIGH : rpio.LOW

      let entity = null

      if (pin.type === 'in') {
        entity = dev.binarySensor('input' + pin.id, pin.name || 'Input #' + pin.id)
        
        rpio.open(pin.id, rpio.INPUT, pin.pull === 'up' ? rpio.PULL_UP : (pin.pull === 'down' ? rpio.PULL_DOWN : rpio.PULL_OFF))
      }

      if (pin.type === 'out') {
        entity = dev.switch('output' + pin.id, pin.name || 'Output #' + pin.id)
        entity.command(value => {
          rpio.write(pin.id, value === stateValues.on ? on : off)
        })

        rpio.open(pin.id, rpio.OUTPUT)
        entity.state(rpio.read(pin.id) == on ? stateValues.on : stateValues.off)
      }

      rpio.poll(pin.id, v => entity.state(rpio.read(v) === on ? stateValues.on : stateValues.off))
    })
  } catch (error) {
    logError(error.message)
  }
}