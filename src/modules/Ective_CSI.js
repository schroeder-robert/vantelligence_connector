const MODE_OPTIONS = {
  0x00: 'OFF',
  0x01: 'UPS',
  0x02: 'ECO'
}

export default ({ device, prop, createSerialConnection, entityUnits, stateValues }) => {
  const dev = device('Ective', 'CSI', '1')
  const connection = prop('connection', { port: '/dev/serial/by-id/' + prop('id') })
  const mode = dev.select('mode', 'Mode', { options: MODE_OPTIONS }, { state: 0, command: (state) => sendSerial([parseInt(state)]) })
  const load = dev.sensor('load', 'Load', { unit: entityUnits.percent })
  const bit1 = dev.binarySensor('bit_1', 'Bit #1', null, { state: stateValues.off })
  const bypass = dev.binarySensor('bypass', 'Bypass', null, { state: stateValues.off })
  const inverter = dev.binarySensor('inverter', 'Inverter', null, { state: stateValues.off })
  const acCharge = dev.binarySensor('ac_charge', 'AC Charge', null, { state: stateValues.off })
  const acIn = dev.binarySensor('ac_in', 'AC In', null, { state: stateValues.off })
  const fault = dev.binarySensor('fault', 'Fault', null, { state: stateValues.off })
  const solarCharge = dev.binarySensor('solar_charge', 'Solar Charge', null, { state: stateValues.off })
  const error = dev.binarySensor('error', 'Error', null, { state: stateValues.off })

  // communication
  const sendSerial = createSerialConnection({ path: connection.port, baudRate: 9600 }, null, (buffer) => {
    const bits = buffer.readUInt8(1)

    mode.state(buffer.readUInt8(0))
    load.state(buffer.readUInt16BE(2))
    error.state(bits & 1 ? stateValues.on : stateValues.off)
    bit1.state((bits >> 1) & 1 ? stateValues.on : stateValues.off)
    bypass.state((bits >> 2) & 1 ? stateValues.on : stateValues.off)
    inverter.state((bits >> 3) & 1 ? stateValues.on : stateValues.off)
    acCharge.state((bits >> 4) & 1 ? stateValues.on : stateValues.off)
    acIn.state((bits >> 5) & 1 ? stateValues.on : stateValues.off)
    fault.state((bits >> 6) & 1 ? stateValues.on : stateValues.off)
    solarCharge.state((bits >> 7) & 1 ? stateValues.on : stateValues.off)
  })
}
