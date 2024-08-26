import Device from './base.js'

const ERROR_PROCESS_MESSAGE = 'Cannot process info message: '

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

    this.sendSerial = this.createSerialConnection({ path: connection.port, baudRate: 9600 })

    this.poll(1000, async () => {
      this.processMessage(await this.sendSerial(Buffer.from([255, 226, 2, 228])))
    })
  }

  processMessage (buffer) {
    let data = {}

    try {
      data.boardBatteryVoltage = buffer.readUInt16BE(4) / 100
      data.panelVoltage = buffer.readUInt16BE(12) / 10
      data.panelPower = buffer.readUInt16BE(10)
      data.chargingCurrent = buffer.readUInt16BE(2) / 10
      data.chargedEnergy = buffer.readUInt16BE(26) / 1000
      data.chargingPower = Math.round(data.boardBatteryVoltage * data.chargingCurrent)
    } catch (e) {
      this.error(ERROR_PROCESS_MESSAGE + e)
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