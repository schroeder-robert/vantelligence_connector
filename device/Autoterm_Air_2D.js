import { SerialPort } from 'serialport'
import { InterByteTimeoutParser } from '@serialport/parser-inter-byte-timeout'
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
  }

  async connect () {
    const { connection } = this.config

    if (connection.type !== 'serial') {
      return 'Connection type not supported!'
    }

    this.port = new SerialPort({
      path: connection.port,
      baudRate: 9600,
      autoOpen: false
    })

    const parser = this.port.pipe(new InterByteTimeoutParser({ interval: 100 }))
    
    parser.on('data', data => this.processMessage(data))

    this.port.open(error => {
      if (error) {
        this.error(error.message)
        this.info('Retrying in 10s')
        
        setTimeout(() => this.connect(), 10000)
      } else {
        this.info('Serial connection successful')
      }
    })
    this.port.on('error', error => this.error(error.message))
    this.port.on('close', () => {
      this.warning('Lost connection!')
      this.connect()
    })
    
    this.requestVersion()

    setTimeout(() => this.poll(2000, 'requestStatus'), 1000)
    setTimeout(() => this.poll(2000, 'requestSettings'), 2000)
  }

  disconnect () {
    this.port.close()
  }

  requestStatus () {
    this.send('status')
  }

  requestSettings () {
    this.send('settings')
  }

  requestVersion () {
    this.send('version')
  }

  requestDiagReport1 () {
    this.send('report', Buffer.from([0x00, 0x40, 0x40]))
  }

  requestDiagReport2 () {
    this.send('report', Buffer.from([0x00, 0x80, 0x40]))
  }

  requestDiagReport3 () {
    this.send('report', Buffer.from([0x00, 0xC0, 0x40]))
  }

  updateSettings () {
    this.send('settings', this.settings)
  }

  startDiag () {
    this.send('diag_control', Buffer.from([0x01]))
  }

  stopDiag () {
    this.send('diag_control', Buffer.from([0x00]))
  }

  turnOn (fanOnly) {
    if (fanOnly) {
      this.send('fan_only', Buffer.from([0x00, 0x00, this.settings[5], 0xFF]))
    } else {
      this.send('heat', this.settings)
    }
  }

  turnOff () {
    this.send('off')
  }

  setTemperatureCurrent (value) {
    this.send('temperature', Buffer.from([parseInt(value)]))
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
    const crc = this.calcCrc(Buffer.concat([header, payload]))
    const buffer = Buffer.concat([header, payload, crc])

    this.port.write(buffer)
  }

  calcCrc (bytes) {
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
    const type = MESSAGE_TYPES[buffer[1]] || buffer[1]
    const length = buffer[2]
    const values = buffer.slice(5, -2)
    const checksum = buffer.slice(-2)
    let id

    if (type === 'request' || type === 'response') {
      id = MESSAGE_IDS[buffer[4]]
    } else if (type === 'diag') {
      id = DIAG_MESSAGE_IDS[buffer[4]]
    }
    
    if (!id) {
      id = buffer[4]
    }

    if (type === 'response') {
      if (id === 'temperature') {
        this.emitEntity({
          name: 'Temperatur Bedienpanel',
          key: 'temperature_panel',
          class: 'temperature',
          unit: '°C',
          states: {
            state: values[0]
          }
        })
      }

      if (id === 'version') {
        this.version = values.slice(0, 4).map(value => parseInt(value)).join('.')
        
        this.emitEntity({
          name: 'Blackbox-Version',
          key: 'blackbox_version',
          states: {
            state: parseInt(values[4])
          }
        })
      }
      
      if (id === 'settings') {
        const workTime = values.slice(0, 1)[0] === 0xFF ? 0 : ((values.slice(0, 1)[0] << 8) | values.slice(1, 2)[0]) / 60
        const sensor = values.slice(2, 3)[0]
        const targetTemperature = values.slice(3, 4)[0]
        const mode = values.slice(4, 5)[0]
        const level = values.slice(5, 6)[0]

        this.settings = values

        this.emitEntity({
          type: 'number',
          name: 'Laufzeit',
          key: 'work_time',
          min: 0,
          max: 12,
          step: 0.5,
          commands: ['command'],
          states: {
            state: workTime
          }
        })

        this.emitEntity({
          type: 'select',
          name: 'Sensor',
          key: 'sensor',
          options: SENSOR_OPTIONS,
          commands: ['command'],
          states: {
            state: SENSOR_OPTIONS[sensor]
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
            state: targetTemperature
          }
        })

        this.emitEntity({
          type: 'select',
          name: 'Modus',
          key: 'mode',
          options: MODE_OPTIONS,
          commands: ['command'],
          states: {
            state: MODE_OPTIONS[mode]
          }
        })
        
        this.emitEntity({
          type: 'select',
          name: 'Leistung',
          key: 'level',
          options: LEVEL_OPTIONS,
          commands: ['command'],
          states: {
            state: LEVEL_OPTIONS[level]
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
            state: level + 1
          }
        })
      }

      if (id === 'status') {
        const statusCode = values.slice(0, 1)[0] + '.' + values.slice(1, 2)[0]
        const boardTemp = values.slice(3, 4)[0]
        const externalTemp = values.slice(4, 5)[0]
        const control = ['0.1', '4.0'].includes(statusCode) ? 'off' : (statusCode === '3.35' ? 'fan_only' : 'heat')
        const status = STATUS_OPTIONS[statusCode] || 'unbekannt'

        this.emitEntity({
          name: 'Temperatur Innenraum',
          key: 'temperature_intake',
          class: 'temperature',
          unit: '°C',
          states: {
            state: boardTemp > 127 ? boardTemp - 255 : boardTemp
          }
        })

        this.emitEntity({
          name: 'Statuscode',
          key: 'status_code',
          states: {
            state: statusCode
          }
        })
        
        this.emitEntity({
          name: 'Status',
          key: 'status',
          states: {
            state: status
          }
        })

        this.emitEntity({
          name: 'Temperatur extern',
          key: 'temperature_sensor',
          class: 'temperature',
          unit: '°C',
          states: {
            state: externalTemp > 127 ? externalTemp - 255 : externalTemp
          }
        })

        this.emitEntity({
          name: 'Spannung',
          key: 'voltage',
          class: 'voltage',
          unit: 'V',
          states: {
            state: values.slice(6, 7)[0] / 10
          }
        })
        
        this.emitEntity({
          name: 'Temperatur Wärmetauscher',
          key: 'temperature_heat_exchanger',
          class: 'temperature',
          unit: '°C',
          states: {
            state: values.slice(8, 9)[0] - 15
          }
        })

        this.emitEntity({
          name: 'Lüfterdrehzahl Vorgabe',
          key: 'fan_rpm_specified',
          unit: 'RPM',
          states: {
            state: values.slice(11, 12)[0] * 60
          }
        })

        this.emitEntity({
          name: 'Lüfterdrehzahl Aktuell',
          key: 'fan_rpm_actual',
          unit: 'RPM',
          states: {
            state: values.slice(12, 13)[0] * 60
          }
        })

        this.emitEntity({
          name: 'Frequenz Kraftstoffpumpe',
          key: 'frequency_fuel_pump',
          class: 'frequency',
          unit: 'Hz',
          states: {
            state: values.slice(14, 15)[0] / 100
          }
        })

        this.emitEntity({
          type: 'select',
          name: 'Steuerung',
          key: 'control',
          options: CONTROL_OPTIONS,
          commands: ['command'],
          states: {
            state: CONTROL_OPTIONS[control]
          }
        })
      }
    }
  }
}
