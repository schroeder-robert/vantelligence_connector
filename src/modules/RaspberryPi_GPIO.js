import rpio from 'rpio'

export default ({ device, prop, stateValues, log, logError }) => {
  const dev = device('Raspberry Pi', 'GPIO', '2')
  const pins = prop('pins')

  try {
    rpio.init({ gpiomem: false })

    pins.forEach(pin => {
      let entity = null

      const emit = pin => {
        const state = rpio.read(pin.id)

        entity.states = {
          state: (state === 1 && !pin.inverted) || (state !== 1 && pin.inverted) ? stateValues.on : stateValues.off
        }

        this.emitEntity(entity)
      }

      if (pin.type === 'in') {
        entity = dev.binarySensor('input' + pin.id, pin.name || 'Input #' + pin.id)
        entity.state(stateValues.off)
        
        rpio.open(pin.id, rpio.INPUT, pin.pull === 'up' ? rpio.PULL_UP : (pin.pull === 'down' ? rpio.PULL_DOWN : rpio.PULL_OFF))
      }

      if (pin.type === 'out') {
        entity = dev.switch('output' + pin.id, pin.name || 'Output #' + pin.id)
        entity.state(stateValues.off)
        entity.command(value => {
          rpio.write(pin.id, (value === stateValues.on && !pin.inverted) || (value !== stateValues.on && pin.inverted) ? rpio.HIGH : rpio.LOW)
        })

        rpio.open(pin.id, rpio.OUTPUT)
      }

      // TO DO
      rpio.poll(pin.id, (v) => log('--------------------------------', v))
    })
  } catch (error) {
    logError(error.message)
  }
}