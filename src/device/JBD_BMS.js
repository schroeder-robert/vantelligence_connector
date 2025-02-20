import base from './base.js'
import KalmanFilter from 'kalmanjs'

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

export const info = {
  manufacturer: 'JBD',
  model: '',
  version: '1'
}

export const device = class extends base {
  constructor (config) {
    super(info, config)
    
    this.sendSerial = null
    this.filters = {
      packVoltage: new KalmanFilter({ R: 5, Q: 1 }),
      packCurrent: new KalmanFilter({ R: 5, Q: 1 })
    }
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
    if (buffer.length < 4) {
      throw new Error('Buffer too short')
    }

    const index = Object.values(REGISTERS).indexOf(buffer.readUInt8(1))

    if (index < 0) {
      this.error(ERROR_REGISTER_UNKNOWN + buffer.readUInt8(1).toString(16))
    }

    const register = Object.keys(REGISTERS)[index]

    if (buffer.readUInt8(2)) {
      this.error(ERROR_REGISTER_RESPONSE + register)
    }

    const data = buffer.slice(4, 4 + buffer.readUInt8(3))

    switch (register) {
      case 'info': return this.proccessInfoMessage(data)
      case 'voltages': return this.processVoltagesMessage(data)
      case 'name': return this.processNameMessage(data)
    }
  }

  processNameMessage (buffer) {
    this.model = buffer.toString()
  }

  processVoltagesMessage (buffer) {
    const count = buffer.length/2

    this.emitEntity({
      name: 'Anzahl Zellen',
      key: 'cells_amount',
      category: this.CATEGORY.diagnostic,
      states: {
        state: count
      }
    })

    for (let i = 0; i < Math.min(count, 32); ++i) {
      this.emitEntity({
        name: 'Zelle ' + (i + 1) + ' Spannung',
        key: 'cell_' + i + '_voltage',
        category: this.CATEGORY.diagnostic,
        class: this.CLASS.voltage,
        unit: this.UNIT.volt,
        states: {
          state: buffer.readUInt16BE(i * 2) / 1000
        }
      })
    }
  }

  proccessInfoMessage (buffer) {
    let data = {}

    try {
      if (buffer.length < 23) {
        throw new Error('Buffer too short')
      }

      data.packVoltage = this.filters.packVoltage.filter(buffer.readUInt16BE(0))
      data.packCurrent = this.filters.packCurrent.filter(buffer.readInt16BE(2))
      data.cycleCapacity = buffer.readUInt16BE(4)
      data.designCapacity = buffer.readUInt16BE(6)
      data.cycleCount = buffer.readUInt16BE(8)
      data.manufactureDate = buffer.readUInt16BE(10)
      data.balance0 = buffer.readUInt16BE(12)
      data.balance1 = buffer.readUInt16BE(14)
      data.errors = buffer.readUInt16BE(16)
      data.softwareVersion = buffer.readUInt8(18)
      data.stateOfCharge = buffer.readUInt8(19)
      data.fetStatus = buffer.readUInt8(20)
      data.packCells = buffer.readUInt8(21)
      data.ntcCount = buffer.readUInt8(22)
    } catch (e) {
      this.error(ERROR_PROCESS_INFO_MESSAGE + e)
    }

    if (!Object.keys(data).length) return

    // console.log(data)

    this.version = '0x' + data.softwareVersion.toString(16)

    for (let i = 0; i < data.ntcCount; ++i) {
      try {
        const temp = buffer.readUInt16BE(23 + (i * 2))
        
        this.emitEntity({
          name: 'Zelle ' + (i + 1) + ' Temperatur',
          key: 'cell_' + i + '_temperature',
          category: this.CATEGORY.diagnostic,
          class: this.CLASS.temperature,
          unit: this.UNIT.celsius,
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
      category: this.CATEGORY.diagnostic,
      states: {
        state: data.ntcCount
      }
    })

    for (let i = 0; i < Math.min(data.packCells, 32); ++i) {
      const bits = i < 16 ? data.balance0 : data.balance1

      this.emitEntity({
        name: 'Zelle ' + (i + 1) + ' Balance',
        key: 'cell_' + i + '_balance',
        category: this.CATEGORY.diagnostic,
        type: this.TYPE.binary_sensor,
        states: {
          state: (bits >> i%16) & 1 ? this.STATE.on : this.STATE.off
        }
      })
    }

    this.emitEntity({
      name: 'Ladung',
      key: 'charge',
      category: this.CATEGORY.diagnostic,
      type: this.TYPE.binary_sensor,
      states: {
        state: data.fetStatus & 1 ? this.STATE.on : this.STATE.off
      }
    })

    this.emitEntity({
      name: 'Entladung',
      key: 'discharge',
      category: this.CATEGORY.diagnostic,
      type: this.TYPE.binary_sensor,
      states: {
        state: data.fetStatus >> 1 ? this.STATE.on : this.STATE.off
      }
    })

    this.emitEntity({
      name: 'Spannung',
      key: 'voltage',
      class: this.CLASS.voltage,
      unit: this.UNIT.volt,
      states: {
        state: Math.round(data.packVoltage) / 100
      }
    })

    this.emitEntity({
      name: 'Strom',
      key: 'current',
      class: this.CLASS.current,
      unit: this.UNIT.ampere,
      states: {
        state: Math.round(data.packCurrent) / 100
      }
    })

    this.emitEntity({
      name: 'Ladezustand',
      key: 'state_of_charge',
      class: this.CLASS.battery,
      unit: this.UNIT.percent,
      states: {
        state: data.stateOfCharge
      }
    })

    this.emitEntity({
      name: 'Herstellungsdatum',
      key: 'manufacture_date',
      category: this.CATEGORY.diagnostic,
      class: this.CLASS.date,
      states: {
        state: [(data.manufactureDate >> 9) + 2000, ((data.manufactureDate >> 5) & 15).toString(10).padStart(2, '0'), (data.manufactureDate & 31).toString(10).padStart(2, '0')].join('-')
      }
    })

    this.emitEntity({
      name: 'Auslegungskapazität',
      key: 'design_capacity',
      category: this.CATEGORY.diagnostic,
      unit: this.UNIT.ampereHour,
      states: {
        state: data.designCapacity / 100
      }
    })

    this.emitEntity({
      name: 'Zykluskapazität',
      key: 'cycle_capacity',
      category: this.CATEGORY.diagnostic,
      unit: this.UNIT.ampereHour,
      states: {
        state: data.cycleCapacity / 100
      }
    })

    this.emitEntity({
      name: 'Ladezyklen',
      key: 'cycle_count',
      category: this.CATEGORY.diagnostic,
      states: {
        state: data.cycleCount
      }
    })

    Object.keys(ERRORS).forEach((key, i) => {
      this.emitEntity({
        name: ERRORS[key],
        key,
        type: this.TYPE.binary_sensor,
        category: this.CATEGORY.diagnostic,
        states: {
          state: (data.errors >> i) & 1 ? this.STATE.on : this.STATE.off
        }
      })
    })
  }
}
