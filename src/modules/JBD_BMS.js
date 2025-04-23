import KalmanFilter from 'kalmanjs'

const START_BYTE = 0xDD
const END_BYTE = 0x77
const READ_BYTE = 0xA5
const WRITE_BYTE = 0x5A
const REGISTERS = {
  info: 0x03,
  voltages: 0x04,
  name: 0x05
}
const ERRORS = {
  cell_overvolt: 'Cell overvolt',
  cell_undervolt: 'Cell undervolt',
  pack_overvolt: 'Pack overvolt',
  pack_undervolt: 'Pack undervolt',
  charge_overtemp: 'Charge overtemp',
  charge_undertemp: 'Charge undertemp',
  discharge_overtemp: 'Discharge overtemp',
  discharge_undertemp: 'Discharge undertemp',
  charge_overcurrent: 'Charge overcurrent',
  discharge_overcurrent: 'Discharge overcurrent',
  short_circuit: 'Short Circuit',
  frontend_ic_error: 'Frontend IC error',
  fet_locked: 'Charge or Discharge FET locked by config (See register 0xE1 "MOSFET control")'
}
const ERROR_REGISTER_RESPONSE = 'Response error for register: '
const ERROR_WRONG_RESPONSE_REGISTER = 'Wrong response register: '
const ERROR_BUFFER_TOO_SHORT = 'Buffer too short'
const ERROR_UNKNOWN_REQUEST_REGISTER = 'Unknown request register: '

export default async ({ device, poll, prop, createSerialConnection, entityClasses, entityCategories, entityUnits, stateValues, log, logError }) => {
  // basics
  const dev = device('JBD', '', '1')
  const connection = prop('connection', { port: '/dev/serial/by-id/' + prop('id') })
  const filters = { packVoltage: new KalmanFilter({ R: 5, Q: 1 }), packCurrent: new KalmanFilter({ R: 5, Q: 1 }) }
  
  // entities
  const name = dev.sensor('name', 'Name')
  const softwareVersion = dev.sensor('software_version', 'Software Version')
  const chargeEnabled = dev.binarySensor('charge', 'Ladung aktiviert', { category: entityCategories.diagnostic })
  const dischargeEnabled = dev.binarySensor('discharge', 'Entladung aktiviert', { category: entityCategories.diagnostic })
  const voltage = dev.sensor('voltage', 'Spannung', { class: entityClasses.voltage, unit: entityUnits.volt })
  const current = dev.sensor('current', 'Strom', { class: entityClasses.current, unit: entityUnits.ampere })
  const stateOfCharge = dev.sensor('state_of_charge', 'Ladezustand', { class: entityClasses.battery, unit: entityUnits.percent })
  const manufactureDate = dev.sensor('manufacture_date', 'Herstellungsdatum', { category: entityCategories.diagnostic, class: entityClasses.date })
  const designCapacity = dev.sensor('design_capacity', 'Auslegungskapazität', { category: entityCategories.diagnostic, unit: entityUnits.ampereHour })
  const cycleCapacity = dev.sensor('cycle_capacity', 'Zykluskapazität', { category: entityCategories.diagnostic, unit: entityUnits.ampereHour })
  const cycleCount = dev.sensor('cycle_count', 'Ladezyklen', { category: entityCategories.diagnostic })
  const cellCount = dev.sensor('cell_count', 'Anzahl Zellen', { category: entityCategories.diagnostic })
  const temperatureSensorCount = dev.sensor('temperature_sensor_count', 'Anzahl Temperatursensoren', { category: entityCategories.diagnostic })
  const errors = Array.from({ length: 16 }).map(id => dev.binarySensor(id, ERRORS[id], { category: entityCategories.diagnostic }))
  const temperatures = []
  const cells = []

  // communication
  const sendSerial = createSerialConnection({ path: connection.port, baudRate: 9600 })
  const read = (key, data) => send(sendSerial, READ_BYTE, key, data)
  const write = (key, data) => send(sendSerial, WRITE_BYTE, key, data)
  const requestName = async () => {
    const buffer = await read('name')

    if (buffer.length < 1) return logError(ERROR_BUFFER_TOO_SHORT, 'Expected: 1', 'Got: ' + buffer.length)

    name.state(buffer.toString())
  }
  const requestBasics = async () => {
    const buffer = await read('info')

    if (buffer.length < 23) return logError(ERROR_BUFFER_TOO_SHORT, 'Expected: 23', 'Got: ' + buffer.length)

    manufactureDate.state((d => [(d >> 9) + 2000, ((d >> 5) & 15).toString(10).padStart(2, '0'), (d & 31).toString(10).padStart(2, '0')].join('-'))(buffer.readUInt16BE(10)))
    softwareVersion.state('0x' + buffer.readUInt8(18).toString(16))
    cellCount.state(buffer.readUInt8(21))
    temperatureSensorCount.state(buffer.readUInt8(22))
  }
  const requestInfo = async () => {
    const buffer = await read('info')

    if (buffer.length < 23) return logError(ERROR_BUFFER_TOO_SHORT, 'Expected: 23', 'Got: ' + buffer.length)

    voltage.state(Math.round(filters.packVoltage.filter(buffer.readUInt16BE(0))) / 100)
    current.state(Math.round(filters.packCurrent.filter(buffer.readInt16BE(2))) / 100)
    cycleCapacity.state(buffer.readUInt16BE(4) / 100)
    designCapacity.state(buffer.readUInt16BE(6) / 100)
    cycleCount.state(buffer.readUInt16BE(8))
    errors.forEach((e, i) => e.state((buffer.readUInt16BE(16) >> i) & 1 ? stateValues.off : stateValues.on))
    stateOfCharge.state(buffer.readUInt8(19))
    chargeEnabled.state(buffer.readUInt8(20) & 1 ? stateValues.on : stateValues.off)
    dischargeEnabled.state(buffer.readUInt8(20) >> 1 ? stateValues.on : stateValues.off)
    cells.forEach((c, i) => c.balance.state(((i < 16 ? buffer.readUInt16BE(12) : buffer.readUInt16BE(14)) >> i%16) & 1 ? stateValues.on : stateValues.off))
    temperatures.forEach((t, i) => t.state((buffer.readUInt16BE(23 + (i * 2)) - 2731) / 10))
  }
  const requestVoltages = async () => {
    const buffer = await read('info')
    const length = cellCount.state() * 2

    if (buffer.length < length) return logError(ERROR_BUFFER_TOO_SHORT, 'Expected: ' + length, 'Got: ' + buffer.length)

    cells.forEach((c, i) => c.voltage.state(buffer.readUInt16BE(i * 2) / 1000))
  }

  await requestName()
  await requestBasics()

  // result dependent entities
  for (let i = 0; i < temperatureSensorCount.state(); ++i) {
    temperatures.push(dev.sensor('temperatute' + i, 'Temperatur #' + (i + 1), { category: entityCategories.diagnostic, class: entityClasses.temperature, unit: entityUnits.celsius }))
  }
  
  for (let i = 0; i < cellCount.state(); ++i) {
    cells.push({
      voltage: dev.sensor('cell' + i + '_voltage', 'Zelle ' + (i + 1) + ' Spannung', {
        category: entityCategories.diagnostic,
        class: entityClasses.voltage,
        unit: entityUnits.volt
      }),
      balance: dev.binarySensor('cell' + i + '_balance', 'Zelle ' + (i + 1) + ' Balance', {
        category: entityCategories.diagnostic,
      })
    })
  }

  // dynamic states
  poll(1000, async () => {
    await requestInfo()
    await requestVoltages()
  })
}

async function send (transport, mode, key, data = []) {
  const reg = REGISTERS[key]

  if (reg === undefined) throw new Error(ERROR_UNKNOWN_REQUEST_REGISTER + key)

  const payload  = [reg, data.length, ...data]
  const bytes = [START_BYTE, mode, ...payload, ...checksum(payload), END_BYTE]
  const buffer = await transport(bytes)
  
  if (buffer.length < 4) throw new Error(ERROR_BUFFER_TOO_SHORT)
  if (buffer.readUInt8(1) !== reg) throw new Error(ERROR_WRONG_RESPONSE_REGISTER + reg + ' vs ' + buffer.readUInt8(1).toString(16))
  if (buffer.readUInt8(2)) throw new Error(ERROR_REGISTER_RESPONSE + key)

  return buffer.slice(4, 4 + buffer.readUInt8(3))
}

function checksum (payload) {
  const checksum = 0x10000 - payload.reduce((s, v) => s + v, 0)

  return Buffer.from([checksum >> 8, checksum & 0xFF])
}