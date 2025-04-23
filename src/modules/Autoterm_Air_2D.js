const TEMP_MIN = 0
const TEMP_MAX = 30

const MESSAGE_TYPES = {
  0x02: 'diag',
  0x03: 'request',
  0x04: 'response'
}

const MESSAGE_IDS = {
  0x01: 'heat' ,
  0x02: 'settings' ,
  0x03: 'off' ,
  0x06: 'version' ,
  0x07: 'diag_control' ,
  0x08: 'fan_speed' ,
  0x0B: 'report' ,
  0x0D: 'unlock' ,
  0x0F: 'status' ,
  0x11: 'temperature' ,
  0x13: 'fuel_pump' ,
  0x1C: 'start' ,
  0x1E: 'misc_3' ,
  0x23: 'fan_only'
}

const DIAG_MESSAGE_IDS = {
  0x00: 'connect',
  0x01: 'heater'
}

const SENSOR_OPTIONS = {
  0x00: 'unbekannt',
  0x01: 'Heizgerät',
  0x02: 'Bedienpanel',
  0x03: 'extern',
  0x04: 'Manuell'
}

const MODE_OPTIONS = {
  0x00: 'Temperatur halten',
  0x01: 'Wärme + Lüftung',
  0x02: 'Stufenreglung',
  0x03: 'Thermostat'
}

const CONTROL_OPTIONS = {
  off: 'Aus',
  heat: 'Heizen',
  fan_only: 'Nur Ventilator'
}

const STATUS_OPTIONS = {
  '0.1': 'Standby',
  '1.0': 'Flammensensor kühlen',
  '1.1': 'Belüftung',
  '2.0': 'Glühkerze aufwärmen',
  '2.1': 'Zündvorbereitung',
  '2.2': 'Zündung',
  '2.3': 'Zündung 2',
  '2.4': 'Brennkammer erhitzen',
  '3.0': 'Heizvorgang',
  '3.35': 'Nur Ventilator',
  '3.4': 'Abkühlung',
  '3.5': 'Temperaturüberwachung',
  '4.0': 'Abschaltung'
}

const SETTINGS = {
  timer: 0,
  sensor: 2,
  target: 3,
  mode: 4,
  level: 5
}

const ERROR_BUFFER_TOO_SHORT = 'Buffer too short'

export default async ({ device, on, poll, prop, createSerialConnection, entityClasses, entityCategories, entityUnits, stateValues, logError }) => {
  // basics
  const dev = device('Autoterm', 'Air 2D', '1')
  const connection = prop('connection', { port: '/dev/serial/by-id/' + prop('id') })
  let bufferSettings = null
  let pollSettings = true
  
  // entities
  const firmwareVersion = dev.sensor('firmware_version', 'Firmware Version')
  const blackboxVersion = dev.sensor('blackbox_version', 'Blackbox Version')
  const status = dev.sensor('status', 'Status')
  const statusCode = dev.sensor('status_code', 'Statuscode', { category: entityCategories.diagnostic })
  const temperatureIntake = dev.sensor('temperature_intake', 'Temperatur Innenraum', { class: entityClasses.temperature, unit: entityUnits.celsius })
  const temperatureSensor = dev.sensor('temperature_sensor', 'Temperatur extern', { class: entityClasses.temperature, unit: entityUnits.celsius })
  const temperatureHeatExchanger = dev.sensor('temperature_heat_exchanger', 'Temperatur Wärmetauscher', { class: entityClasses.temperature, unit: entityUnits.celsius })
  const temperaturePanel = dev.sensor('temperature_panel', 'Temperatur Bedienpanel', { class: entityClasses.temperature, unit: entityUnits.celsius })
  const voltage = dev.sensor('voltage', 'Spannung', { class: entityClasses.voltage, unit: entityUnits.volt, category: entityCategories.diagnostic })
  const fanRpmSpecified = dev.sensor('fan_rpm_specified', 'Lüfterdrehzahl Vorgabe', { category: entityCategories.diagnostic, unit: entityUnits.rpm })
  const fanRpmActual = dev.sensor('fan_rpm_actual', 'Lüfterdrehzahl Aktuell', { unit: entityUnits.rpm })
  const frequencyFuelPump = dev.sensor('frequency_fuel_pump', 'Frequenz Kraftstoffpumpe', { category: entityCategories.diagnostic, class: entityClasses.frequency, unit: entityUnits.hertz })
  const sensor = dev.select('sensor', 'Sensor', { category: entityCategories.config, options: SENSOR_OPTIONS })
  const control = dev.select('control', 'Steuerung', { icon: 'mdi:power', options: CONTROL_OPTIONS })
  const mode = dev.select('mode', 'Modus', { options: MODE_OPTIONS })
  const target = dev.number('temperature_target', 'Temperatur Sollwert', { min: TEMP_MIN, max: TEMP_MAX })
  const timer = dev.select('timer', 'Laufzeit', { icon: 'mdi:camera-timer', options: Object.fromEntries(Array.from({ length: 25 }, (v, i) => ((m, h) => [m, i ? Math.floor(h) + (h % 1 ? ':30' : '') + ' h' : '∞'])(30 * i, i / 2))) })
  const level = dev.number('level', 'Stufe', { icon: 'mdi:signal-cellular-3', min: 1, max: 10 })

  // communication
  const sendSerial = createSerialConnection({ path: connection.port, baudRate: 9600 })
  const requestVersion = async () => {
    const buffer = await send(sendSerial, 'version')

    if (buffer.length < 5) return logError(ERROR_BUFFER_TOO_SHORT, 'Expected: 5', 'Got: ' + buffer.length)
    
    firmwareVersion.state(Array.from({ length: 4 }).map((v, i) => buffer.readUInt8(i)).join('.'))
    blackboxVersion.state(buffer.readUInt8(4))
  }
  const requestStatus = async () => {
    const buffer = await send(sendSerial, 'status')

    if (buffer.length < 15) return logError(ERROR_BUFFER_TOO_SHORT, 'Expected: 15', 'Got: ' + buffer.length)
    
    const code = buffer.readUInt8(0) + '.' + buffer.readUInt8(1)
    
    control.state(CONTROL_OPTIONS[['0.1', '4.0'].includes(code) ? 'off' : (code === '3.35' ? 'fan_only' : 'heat')])
    statusCode.state(code)
    status.state(STATUS_OPTIONS[code] || code)
    voltage.state(buffer.readUInt8(6) / 10)
    temperatureIntake.state(buffer.readInt8(3))
    temperatureSensor.state(buffer.readInt8(4))
    temperatureHeatExchanger.state(buffer.readUInt8(8) - 15)
    fanRpmSpecified.state(buffer.readUInt8(11) * 60)
    fanRpmActual.state(buffer.readUInt8(12) * 60)
    frequencyFuelPump.state(buffer.readUInt8(14) / 100)
  }
  const requestSettings = async (payload) => {
    const buffer = await send(sendSerial, 'settings', payload)

    if (buffer.length < 6) return logError(ERROR_BUFFER_TOO_SHORT, 'Expected: 6', 'Got: ' + buffer.length)
    
    bufferSettings = buffer
    timer.state((v => v === 65535 ? 0 : v)(buffer.readUInt16BE(0)))
    sensor.state(buffer.readUInt8(2))
    target.state(buffer.readUInt8(3))
    mode.state(buffer.readUInt8(4))
    level.state(buffer.readUInt8(5) + 1)
    level.availability(mode.state() === 2 ? 'online' : 'offline')
  }
  const reportTemperature = async (value) => {
    const buffer = await send(sendSerial, 'temperature', Buffer.from([parseInt(value)]))
  
    if (buffer.length < 1) return logError(ERROR_BUFFER_TOO_SHORT, 'Expected: 1', 'Got: ' + buffer.length)

    temperaturePanel.state(buffer.readUInt8(0))
  }
  const requestDiagReport1 = () => send(sendSerial, 'report', Buffer.from([0x00, 0x40, 0x40]))
  const requestDiagReport2 = () => send(sendSerial, 'report', Buffer.from([0x00, 0x80, 0x40]))
  const requestDiagReport3 = () => send(sendSerial, 'report', Buffer.from([0x00, 0xC0, 0x40]))
  const startDiag = () => send(sendSerial, 'diag_control', Buffer.from([0x01]))
  const stopDiag = () => send(sendSerial, 'diag_control', Buffer.from([0x00]))
  const turnOff = () => send(sendSerial, 'off', bufferSettings)
  const turnOn = (fanOnly) => {
    if (fanOnly) {
      return send(sendSerial, 'fan_only', Buffer.from([0x00, 0x00, bufferSettings[5], 0xFF]))
    } else {
      return send(sendSerial, 'heat', bufferSettings)
    }
  }
  const updateSettings = async (index, value) => {
    pollSettings = false
    bufferSettings.writeUIntBE(value, index, index === SETTINGS.timer ? 2 : 1)
    
    await requestSettings(bufferSettings)

    pollSettings = true
  }

  // commands
  control.command(value => {
    if (!(value in CONTROL_OPTIONS)) return

    if (value === 'off') turnOff()
    else turnOn(value === 'fan_only')

    control.state(value)
  })

  timer.command(value => {
    value = parseFloat(value)
    
    if (value < 0 || value > 720) return

    updateSettings(SETTINGS.timer, value ? value : 65535)
  })

  sensor.command(value => {
    value = Number(value)
    
    if (!(value in SENSOR_OPTIONS)) return

    updateSettings(SETTINGS.sensor, value)
  })

  target.command(value => {
    value = Number(value)

    if (value < TEMP_MIN || value > TEMP_MAX) return

    updateSettings(SETTINGS.target, value)
  })

  mode.command(async value => {
    value = Number(value)

    if (!(value in MODE_OPTIONS)) return

    updateSettings(SETTINGS.mode, value)
  })

  level.command(value => {
    value = Number(value) - 1

    if (value < 0 || value > 9) return

    updateSettings(SETTINGS.level, value)
  })

  on('temperature_current', value => {
    reportTemperature(Math.round(value))
  })

  await requestVersion()

  // dynamic states
  poll(2000, async () => {   
    await requestStatus()

    if (pollSettings) await requestSettings()
  })
}

async function send (transport, key, payload) {
  payload = payload || Buffer.alloc(0)

  const id = Object.keys(MESSAGE_IDS)[Object.values(MESSAGE_IDS).indexOf(key)]
  const header = Buffer.from([0xAA, 0x03, payload.length, 0x00, id])
  const bytes = Buffer.concat([header, payload, checksum(Buffer.concat([header, payload]))])
  const buffer = await transport(bytes)
  
  if (buffer.length < 5) {
    throw new Error('Buffer too short')
  }

  const type = MESSAGE_TYPES[buffer.readUInt8(1)] || buffer.readUInt8(1)
  // const length = buffer[2]
  // const checksum = buffer.slice(-2)
  // let id

  // if (type === 'request' || type === 'response') {
  //   id = MESSAGE_IDS[buffer.readUInt8(4)]
  // } else if (type === 'diag') {
  //   id = DIAG_MESSAGE_IDS[buffer.readUInt8(4)]
  // }
  
  // if (!id) {
  //   id = buffer.readUInt8(4)
  // }

  return buffer.slice(5, -2)
}

function checksum (bytes) {
  let crc = 0xFFFF
  const buffer = Buffer.alloc(2)
  
  for (let pos = 0; pos < bytes.length; pos++) {
    crc = crc ^ bytes[pos]
  
    for (let i = 0; i < 8; i++) {
      let odd = crc & 0x0001
      
      crc >>= 1
  
      if (odd) {
        crc ^= 0xA001
      }
    }
  }
  
  buffer[0] = (crc >> 8) & 0xFF
  buffer[1] = crc & 0xFF
  
  return buffer
}