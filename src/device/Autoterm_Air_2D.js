import Device from './base.js'

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

const LEVEL_OPTIONS = {
  0x00: '10%',
  0x01: '20%',
  0x02: '30%',
  0x03: '40%',
  0x04: '50%',
  0x05: '60%',
  0x06: '70%',
  0x07: '80%',
  0x08: '90%',
  0x09: '100%'
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

const ERROR_PROCESS_STATUS_MESSAGE = 'Cannot process status message: '
const ERROR_PROCESS_SETTINGS_MESSAGE = 'Cannot process settings message: '
const ERROR_PROCESS_TEMPERATURE_MESSAGE = 'Cannot process temperature message: '

export default class extends Device {
  constructor (config) {
    super(config)
    
    this.manufacturer = 'Autoterm'
    this.model = 'Air 2D'
    this.version = ''
    this.buffer = []
    this.timeout = null
    this.port = null
    this.settings = null
    this.options = {
      status: STATUS_OPTIONS,
      mode: MODE_OPTIONS,
      level: LEVEL_OPTIONS,
      control: CONTROL_OPTIONS,
      sensor: SENSOR_OPTIONS
    }
    this.sendSerial = null
  }

  async connect () {
    const { connection } = this.config

    if (connection.type !== 'serial') {
      return 'Connection type not supported!'
    }

    this.sendSerial = this.createSerialConnection({ path: connection.port, baudRate: 9600 })
    this.processMessage(await this.requestVersion())
    this.poll(2000, async () => {
      this.processMessage(await this.requestStatus())
      this.processMessage(await this.requestSettings())
    })
  }

  requestStatus () {
    return this.send('status')
  }

  requestSettings () {
    return this.send('settings')
  }

  requestVersion () {
    return this.send('version')
  }

  requestDiagReport1 () {
    return this.send('report', Buffer.from([0x00, 0x40, 0x40]))
  }

  requestDiagReport2 () {
    return this.send('report', Buffer.from([0x00, 0x80, 0x40]))
  }

  requestDiagReport3 () {
    return this.send('report', Buffer.from([0x00, 0xC0, 0x40]))
  }

  updateSettings () {
    return this.send('settings', this.settings)
  }

  startDiag () {
    return this.send('diag_control', Buffer.from([0x01]))
  }

  stopDiag () {
    return this.send('diag_control', Buffer.from([0x00]))
  }

  turnOn (fanOnly) {
    if (fanOnly) {
      return this.send('fan_only', Buffer.from([0x00, 0x00, this.settings[5], 0xFF]))
    } else {
      return this.send('heat', this.settings)
    }
  }

  turnOff () {
    return this.send('off')
  }

  setTemperatureCurrent (value) {
    return this.send('temperature', Buffer.from([parseInt(value)]))
  }

  setWorkTime (value) {
    if (parseFloat(value)) {
      value = value * 60

      this.settings[0] = value >> 8
      this.settings[1] = value & 0xFF
    } else {
      this.settings[0] = 0xFF
      this.settings[1] = 0xFF
    }

    this.updateSettings()
  }

  setSensor (value) {
    if (typeof SENSOR_OPTIONS[value] !== 'undefined') {
      this.settings[2] = value

      this.updateSettings()
    }
  }

  setTemperatureTarget (value) {
    this.settings[3] = parseInt(value)

    this.updateSettings()
  }

  setMode (value) {
    this.settings[4] = value === 'ON' ? 1 : 2

    this.updateSettings()
  }

  setPower (value) {
    this.setLevel(value - 1)
  }

  setLevel (value) {
    if (typeof LEVEL_OPTIONS[value] !== 'undefined') {
      this.settings[5] = value

      this.updateSettings()
    }
  }

  setControl (value) {
    if (typeof CONTROL_OPTIONS[value] !== 'undefined') {
      if (value === 'off') {
        this.turnOff()
      } else {
        this.turnOn(value === 'fan_only')
      }
    }
  }

  send (key, payload) {
    payload = payload || Buffer.alloc(0)

    const id = Object.keys(MESSAGE_IDS)[Object.values(MESSAGE_IDS).indexOf(key)]
    const header = Buffer.from([0xAA, 0x03, payload.length, 0x00, id])
    const checksum = this.calcChecksum(Buffer.concat([header, payload]))
    const buffer = Buffer.concat([header, payload, checksum])

    return this.sendSerial(buffer)
  }

  calcChecksum (bytes) {
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

  processMessage (buffer) {
    if (buffer.length < 5) {
      throw new Error('Buffer too short')
    }

    const type = MESSAGE_TYPES[buffer.readUInt8(1)] || buffer.readUInt8(1)
    const length = buffer[2]
    const payload = buffer.slice(5, -2)
    const checksum = buffer.slice(-2)
    let id

    if (type === 'request' || type === 'response') {
      id = MESSAGE_IDS[buffer.readUInt8(4)]
    } else if (type === 'diag') {
      id = DIAG_MESSAGE_IDS[buffer.readUInt8(4)]
    }
    
    if (!id) {
      id = buffer.readUInt8(4)
    }

    if (type === 'response') {
      switch (id) {
        case 'version': return this.processVersionMessage(payload)
        case 'status': return this.processStatusMessage(payload)
        case 'settings': return this.processSettingsMessage(payload)
        case 'temperature': return this.processTemperatureMessage(payload)
      }
    }
  }

  processVersionMessage (buffer) {
    this.version = buffer.slice(0, 4).map(v => parseInt(v)).join('.')
 
    this.emitEntity({
      name: 'Blackbox-Version',
      key: 'blackbox_version',
      category: this.CATEGORY.diagnostic,
      states: {
        state: parseInt(buffer[4])
      }
    })
  }

  processStatusMessage (buffer) {
    let data = {}

    try {
      if (buffer.length < 15) {
        throw new Error('Buffer too short')
      }

      data.statusCode = buffer.readUInt8(0) + '.' + buffer.readUInt8(1)
      data.boardTemp = buffer.readUInt8(3)
      data.externalTemp = buffer.readInt8(4)
      data.control = ['0.1', '4.0'].includes(data.statusCode) ? 'off' : (data.statusCode === '3.35' ? 'fan_only' : 'heat')
      data.status = STATUS_OPTIONS[data.statusCode] || 'unbekannt'
      data.voltage = buffer.readUInt8(6) / 10
      data.temperatureHeatExchanger = buffer.readUInt8(8) - 15
      data.fanRpmSpecified = buffer.readUInt8(11) * 60
      data.fanRpmActual = buffer.readUInt8(12) * 60
      data.frequencyFuelPump = buffer.readUInt8(14) / 100
    } catch (e) {
      this.error(ERROR_PROCESS_STATUS_MESSAGE + e)
    }

    this.emitEntity({
      name: 'Temperatur Innenraum',
      key: 'temperature_intake',
      class: this.CLASS.temperature,
      unit: this.UNIT.celsius,
      states: {
        state: data.boardTemp > 127 ? data.boardTemp - 255 : data.boardTemp
      }
    })

    this.emitEntity({
      name: 'Statuscode',
      key: 'status_code',
      category: this.CATEGORY.diagnostic,
      states: {
        state: data.statusCode
      }
    })
    
    this.emitEntity({
      name: 'Status',
      key: 'status',
      states: {
        state: data.status
      }
    })

    this.emitEntity({
      name: 'Temperatur extern',
      key: 'temperature_sensor',
      class: this.CLASS.temperature,
      category: this.CATEGORY.diagnostic,
      unit: this.UNIT.celsius,
      states: {
        state: data.externalTemp
      }
    })

    this.emitEntity({
      name: 'Spannung',
      key: 'voltage',
      class: this.CLASS.voltage,
      unit: this.UNIT.volt,
      category: this.CATEGORY.diagnostic,
      states: {
        state: data.voltage
      }
    })
    
    this.emitEntity({
      name: 'Temperatur Wärmetauscher',
      key: 'temperature_heat_exchanger',
      class: this.CLASS.temperature,
      unit: this.UNIT.celsius,
      states: {
        state: data.temperatureHeatExchanger
      }
    })

    this.emitEntity({
      name: 'Lüfterdrehzahl Vorgabe',
      key: 'fan_rpm_specified',
      category: this.CATEGORY.diagnostic,
      unit: this.UNIT.rpm,
      states: {
        state: data.fanRpmSpecified
      }
    })

    this.emitEntity({
      name: 'Lüfterdrehzahl Aktuell',
      key: 'fan_rpm_actual',
      unit: this.UNIT.rpm,
      states: {
        state: data.fanRpmActual
      }
    })

    this.emitEntity({
      name: 'Frequenz Kraftstoffpumpe',
      key: 'frequency_fuel_pump',
      category: this.CATEGORY.diagnostic,
      class: this.CLASS.frequency,
      unit: this.UNIT.hertz,
      states: {
        state: data.frequencyFuelPump
      }
    })

    this.emitEntity({
      type: 'select',
      name: 'Steuerung',
      key: 'control',
      options: CONTROL_OPTIONS,
      commands: ['command'],
      states: {
        state: CONTROL_OPTIONS[data.control]
      }
    })
  }

  processSettingsMessage (buffer) {
    let data = {}

    this.settings = buffer

    try {
      if (buffer.length < 6) {
        throw new Error('Buffer too short')
      }

      data.workTime = buffer.readUInt16BE(0) / 60
      data.sensor = buffer.readUInt8(2)
      data.targetTemperature = buffer.readUInt8(3)
      data.mode = buffer.readUInt8(4)
      data.level = buffer.readUInt8(5)
    } catch (e) {
      this.error(ERROR_PROCESS_SETTINGS_MESSAGE + e)
    }

    this.emitEntity({
      type: 'number',
      name: 'Laufzeit',
      key: 'work_time',
      min: 0,
      max: 12,
      step: 0.5,
      commands: ['command'],
      states: {
        state: data.workTime
      }
    })

    this.emitEntity({
      type: 'select',
      name: 'Sensor',
      key: 'sensor',
      category: this.CATEGORY.config,
      options: SENSOR_OPTIONS,
      commands: ['command'],
      states: {
        state: SENSOR_OPTIONS[data.sensor]
      }
    })

    this.emitEntity({
      type: 'number',
      name: 'Temperatur Sollwert',
      key: 'temperature_target',
      min: TEMP_MIN,
      max: TEMP_MAX,
      commands: ['command'],
      states: {
        state: data.targetTemperature
      }
    })

    this.emitEntity({
      type: 'select',
      name: 'Modus',
      key: 'mode',
      options: MODE_OPTIONS,
      commands: ['command'],
      states: {
        state: MODE_OPTIONS[data.mode]
      }
    })
    
    this.emitEntity({
      type: 'select',
      name: 'Leistung',
      key: 'level',
      options: LEVEL_OPTIONS,
      commands: ['command'],
      states: {
        state: LEVEL_OPTIONS[data.level]
      }
    })
    
    this.emitEntity({
      type: 'number',
      name: 'Leistung',
      key: 'power',
      min: 1,
      max: 10,
      commands: ['command'],
      states: {
        state: data.level + 1
      }
    })
  }

  processTemperatureMessage (buffer) {
    let data = {}

    try {
      if (buffer.length < 1) {
        throw new Error()
      }

      data.value = buffer.readUInt8(0)
    } catch (e) {
      this.error(ERROR_PROCESS_TEMPERATURE_MESSAGE + e)
    }

    this.emitEntity({
      name: 'Temperatur Bedienpanel',
      key: 'temperature_panel',
      class: this.CLASS.temperature,
      unit: this.UNIT.celsius,
      states: {
        state: data.value
      }
    })
  }
}
