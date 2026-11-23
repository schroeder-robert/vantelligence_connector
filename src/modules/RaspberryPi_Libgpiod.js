import { exec, spawn } from 'child_process'

export default ({ device, prop, stateValues, poll, log, logError }) => {
  const dev = device('Raspberry Pi', 'Libgpiod', '1')
  const pins = prop('pins', [])
  const chip = prop('chip', 'gpiochip0')
  const list = []

  try {
    pins.forEach(pin => {
      let entity = null

      if (pin.type === 'in') {
        list.push({ pin, entity: dev.binarySensor('input' + pin.id, pin.name || 'Input #' + pin.id) })
      }

      if (pin.type === 'out') {
        entity = dev.switch('output' + pin.id, pin.name || 'Output #' + pin.id)
        entity.command(value => {
          exec(`gpioset ${pin.inverted ? '-l ' : ''}-c ${chip} -t 200ms,0 ${pin.id}=${value === stateValues.on ? 1 : 0}`, (e) => {
            if (e) {
              logError(`Fehler beim ZV-Impuls an Pin ${pin.id}: `, e)
            }

            log(value)
          })
        })

        list.push({ pin, entity })
      }
    })

    poll(1000, () => {
      list.forEach(({ pin, entity }) => {
        exec(`gpioget ${pin.inverted ? '-l ' : ''}-c ${chip} ${pin.id}`, (e, o) => {
          if (e) return logError(`Fehler beim Abfragen des Initialzustands von Pin ${pin.id}: `, e)

          entity.state(o.toString().trim() === `"${pin.id}"=active` ? stateValues.on : stateValues.off)
          log(`gpioget ${pin.inverted ? '-l ' : ''}-c ${chip} ${pin.id}`, o.toString().trim())
        })
      })
    })
  } catch (error) {
    logError(error.message)
  }
}