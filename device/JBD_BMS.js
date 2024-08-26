import Device from './base.js'

const START_BYTE = 0xDD
const END_BYTE = 0x77
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
const ERROR_PROCESS_INFO_MESSAGE = 'Cannot process info message: '
const ERROR_REGISTER_RESPONSE = 'Response error for register: '
const ERROR_REGISTER_UNKNOWN = 'Unknown response register: '

export default class extends Device {
  constructor (config) {
    super(config)
    
    this.manufacturer = 'JBD'
    this.sendSerial = null
  }

  async connect () {
    const { connection } = this.config

    if (connection.type !== 'serial') {
      return 'Connection type not supported!'
    }

    this.sendSerial = this.createSerialConnection({ path: connection.port, baudRate: 9600 })
    
    this.poll(1000, async () => {
      this.processMessage(await this.read('name'))
      this.processMessage(await this.read('info'))
      this.processMessage(await this.read('voltages'))
    })
  }

  read (key, data) {
    return this.send(0xA5, key, data)
  }

  write (key, data) {
    return this.send(0x5A, key, data)
  }

  send (mode, key, data = []) {
    const reg = REGISTERS[key]

    if (reg === undefined) {
      this.error('Unknown request register: ' + key)

      return
    }

    const payload  = [reg, data.length, ...data]
    const bytes = [START_BYTE, mode, ...payload, ...this.calcChecksum(payload), END_BYTE]

    return this.sendSerial(bytes)
  }

  calcChecksum (payload) {
    const checksum = 0x10000 - payload.reduce((s, v) => s + v, 0)

    return Buffer.from([checksum >> 8, checksum & 0xFF])
  }

  processMessage (buffer) {
    const index = Object.values(REGISTERS).indexOf(buffer[1])

    if (index < 0) {
      this.error(ERROR_REGISTER_UNKNOWN + buffer[1].toString(16))
    }

    const register = Object.keys(REGISTERS)[index]

    if (buffer[2]) {
      this.error(ERROR_REGISTER_RESPONSE + register)
    }

    const data = buffer.slice(4, 4 + buffer[3])

    switch (register) {
      case 'info': return this.proccessInfoMessage(data)
      case 'voltages': return this.processVoltagesMessage(data)
      case 'name': return this.processNameMessage(data)
    }
  }

  processNameMessage (values) {
    this.model = values.toString()
  }

  processVoltagesMessage (values) {
    const count = values.length/2

    this.emitEntity({
      name: 'Anzahl Zellen',
      key: 'cells_amount',
      states: {
        state: count
      }
    })

    for (let i = 0; i < Math.min(count, 32); ++i) {
      this.emitEntity({
        name: ' Zelle ' + (i + 1) + ' Spannung',
        key: 'cell_' + i + '_voltage',
        class: 'voltage',
        unit: 'V',
        states: {
          state: values.readUInt16BE(i * 2) / 1000
        }
      })
    }
  }

  proccessInfoMessage (values) {
    let data = {}

    try {
      data = {
        packVoltage: values.readUInt16BE(0),
        packCurrent: values.readUInt16BE(2),
        cycleCapacity: values.readUInt16BE(4),
        designCapacity: values.readUInt16BE(6),
        cycleCount: values.readUInt16BE(8),
        manufactureDate: values.readUInt16BE(10),
        balance0: values.readUInt16BE(12),
        balance1: values.readUInt16BE(14),
        errors: values.readUInt16BE(16),
        softwareVersion: values.readUInt8(18),
        stateOfCharge: values.readUInt8(19),
        fetStatus: values.readUInt8(20),
        packCells: values.readUInt8(21),
        ntcCount: values.readUInt8(22)
      }
    } catch (e) {
      this.error(ERROR_PROCESS_INFO_MESSAGE + e)
    }

    if (!Object.keys(data).length) return

    // console.log(data)

    this.version = '0x' + data.softwareVersion.toString(16)

    for (let i = 0; i < data.ntcCount; ++i) {
      try {
        const temp = values.readUInt16BE(23 + (i * 2))
        
        this.emitEntity({
          name: 'Zelle ' + (i + 1) + ' Temperatur',
          key: 'cell_' + i + '_temperature',
          class: 'temperature',
          unit: '°C',
          states: {
            state: (temp - 2731) / 10
          }
        })
      } catch (e) {
        this.error(ERROR_PROCESS_INFO_MESSAGE + e)
      }
    }

    this.emitEntity({
      name: 'Anzahl Temperatursensoren',
      key: 'temperature_sensor_count',
      states: {
        state: data.ntcCount
      }
    })

    for (let i = 0; i < Math.min(data.packCells, 32); ++i) {
      const bits = i < 16 ? data.balance0 : data.balance1

      this.emitEntity({
        name: 'Zelle ' + (i + 1) + ' Balance',
        key: 'cell_' + i + '_balance',
        type: 'binary_sensor',
        states: {
          state: (bits >> i%16) & 1 ? 'ON' : 'OFF'
        }
      })
    }

    this.emitEntity({
      name: 'Ladung',
      key: 'charge',
      type: 'binary_sensor',
      states: {
        state: data.fetStatus & 1 ? 'ON' : 'OFF'
      }
    })

    this.emitEntity({
      name: 'Entladung',
      key: 'discharge',
      type: 'binary_sensor',
      states: {
        state: data.fetStatus >> 1 ? 'ON' : 'OFF'
      }
    })

    this.emitEntity({
      name: 'Spannung',
      key: 'voltage',
      class: 'voltage',
      unit: 'V',
      states: {
        state: data.packVoltage / 100
      }
    })

    this.emitEntity({
      name: 'Strom',
      key: 'current',
      class: 'current',
      unit: 'A',
      states: {
        state: data.packCurrent
      }
    })

    this.emitEntity({
      name: 'Ladezustand',
      key: 'state_of_charge',
      class: 'battery',
      unit: '%',
      states: {
        state: data.stateOfCharge
      }
    })

    this.emitEntity({
      name: 'Herstellungsdatum',
      key: 'manufacture_date',
      class: 'date',
      states: {
        state: [(data.manufactureDate >> 9) + 2000, ((data.manufactureDate >> 5) & 15).toString(10).padStart(2, '0'), (data.manufactureDate & 31).toString(10).padStart(2, '0')].join('-')
      }
    })

    this.emitEntity({
      name: 'Auslegungskapazität',
      key: 'design_capacity',
      class: 'energy',
      unit: 'Ah',
      states: {
        state: data.designCapacity / 100
      }
    })

    this.emitEntity({
      name: 'Zykluskapazität',
      key: 'cycle_capacity',
      class: 'energy',
      unit: 'Ah',
      states: {
        state: data.cycleCapacity / 100
      }
    })

    this.emitEntity({
      name: 'Ladezyklen',
      key: 'cycle_count',
      states: {
        state: data.cycleCount
      }
    })

    Object.keys(ERRORS).forEach((key, i) => {
      this.emitEntity({
        name: ERRORS[key],
        key,
        type: 'event',
        events: 'pressed',
        states: {
          state: (data.errors >> i) & 1 ? 'ON' : 'OFF'
        }
      })
    })
  }
}
