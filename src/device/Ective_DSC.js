import Device from './base.js'
import { DelimiterParser } from '@serialport/parser-delimiter'

const REGISTERS = {
  other: 0xe1,
  status: 0xe2
}

const ERROR_PROCESS_STATUS_MESSAGE = 'Cannot process info message: '
const ERROR_REGISTER_UNKNOWN = 'Unknown response register: '

export default class extends Device {
  constructor (config) {
    super(config)
    
    this.manufacturer = 'Ective'
    this.model = 'DSC'
    this.version = '1'
    this.sendSerial = null
  }

  async connect () {
    const { connection } = this.config

    if (connection.type !== 'serial') {
      return 'Connection type not supported!'
    }

    this.sendSerial = this.createSerialConnection({ path: connection.port, baudRate: 9600 }, new DelimiterParser({ delimiter: Buffer.from([0xFF]) }))

    this.poll(3000, async () => {
      this.processMessage(await this.sendSerial(Buffer.from([255, 226, 2, 228])))
    })
  }

  processMessage (buffer) {
    if (buffer.length < 1) {
      throw new Error('Buffer too short')
    }

    const index = Object.values(REGISTERS).indexOf(buffer.readUInt8(0))

    if (index < 0) {
      this.error(ERROR_REGISTER_UNKNOWN + buffer.readUInt8(0).toString(16))
    }

    const register = Object.keys(REGISTERS)[index]
    const data = buffer.slice(1)

    switch (register) {
      case 'other': return this.processOtherMessage(data)
      case 'status': return this.processStatusMessage(data)
    }
  }

  processOtherMessage (buffer) {
    // console.log('OTHER', buffer.readUInt16BE(0))
  }

  processStatusMessage (buffer) {
    let data = {}

    try {
      if (buffer.length < 38) {
        throw new Error()
      }

      data.chargingCurrent = buffer.readUInt16BE(0) / 10
      data.boardBatteryVoltage = buffer.readUInt16BE(2) / 100
      data.unknown0 = buffer.readUInt16BE(4)
      data.unknown1 = buffer.readUInt16BE(6)
      data.panelPower = buffer.readUInt16BE(8)
      data.panelVoltage = buffer.readUInt16BE(10) / 10
      data.unknown2 = buffer.readUInt16BE(12)
      data.unknown3 = buffer.readUInt16BE(14)
      data.unknown4 = buffer.readUInt16BE(16)
      data.unknown5 = buffer.readUInt16BE(18)
      data.unknown6 = buffer.readUInt16BE(20)
      data.unknown7 = buffer.readUInt16BE(22)
      data.chargedEnergy = buffer.readUInt16BE(24) / 1000
      data.unknown8 = buffer.readUInt16BE(26)
      data.unknown9 = buffer.readUInt16BE(28)
      data.unknown10 = buffer.readUInt16BE(30)
      data.unknown11 = buffer.readUInt16BE(32)
      data.unknown12 = buffer.readUInt16BE(34)
      data.unknown13 = buffer.readUInt16BE(36)
      data.chargingPower = Math.round(data.boardBatteryVoltage * data.chargingCurrent)
    } catch (e) {
      this.error(ERROR_PROCESS_STATUS_MESSAGE + e)
    }

    this.emitEntity({
      name: 'Spannung Bordbatterie',
      key: 'voltage_board_battery',
      class: 'voltage',
      unit: 'V',
      states: {
        state: data.boardBatteryVoltage
      }
    })

    this.emitEntity({
      name: 'Spannung Eingang',
      key: 'panel_voltage',
      class: 'voltage',
      unit: 'V',
      states: {
        state: data.panelVoltage
      }
    })

    this.emitEntity({
      name: 'Leistung Eingang',
      key: 'panel_power',
      class: 'power',
      unit: 'W',
      states: {
        state: data.panelPower
      }
    })

    this.emitEntity({
      name: 'Leistung Ausgang',
      key: 'charging_power',
      class: 'power',
      unit: 'W',
      states: {
        state: data.chargingPower
      }
    })

    this.emitEntity({
      name: 'Ladestrom',
      key: 'charging_current',
      class: 'current',
      unit: 'A',
      states: {
        state: data.chargingCurrent
      }
    })

    this.emitEntity({
      name: 'Geladene Energie',
      key: 'charging_energy',
      class: 'energy',
      unit: 'kWh',
      states: {
        state: data.chargedEnergy
      }
    })
  }
}