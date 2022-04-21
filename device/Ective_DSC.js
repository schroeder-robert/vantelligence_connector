import SerialPort from 'serialport'
import Device from './base.js'

export default class extends Device {
  constructor (config) {
    super(config)
    
    this.manufacturer = 'Ective'
    this.model = 'DSC'
    this.version = '1'
    this.buffer = []
    this.timeout = null
    this.port = null
  }

  async connect () {
    const config = this.config.connection

    if (config.type !== 'serial') {
      return 'Connection type not supported!'
    }

    this.port = new SerialPort(config.port, {
      baudRate: 9600,
      autoOpen: false
    })

    this.port.open(error => {
      return error ? error.message : true
    })

    this.port.on('data', data => {
      this.buffer.push(data)
    
      clearTimeout(this.timeout)
    
      this.timeout = setTimeout(() => {
        this.processMessage(Buffer.concat(this.buffer))
    
        this.buffer = []
      }, 50)
    })

    this.poll('requestValues', 10000)
  }

  disconnect () {
    this.port.close()
  }

  decodeBytes (buffer) {
    const values = []

    for (let i = 0; i < buffer.length; i += 2) {
      values.push((buffer[i] << 8) | buffer[i + 1])
    }

    return values
  }

  requestValues () {
    this.port.write(Buffer.from([255, 226, 2, 228]))
  }

  processMessage (buffer) {
    const values = this.decodeBytes(buffer)
  
    if (values[0] === 65506) {
      const boardBatteryVoltage = values[2] / 100
      const panelVoltage = values[6] / 10
      const panelPower = values[5]
      const chargingCurrent = values[1] / 10
      const chargedEnergy = values[13] / 1000
      const chargingPower = Math.round(boardBatteryVoltage * chargingCurrent)

      this.emitEntity({
        name: 'Spannung Bordbatterie',
        key: 'voltage_board_battery',
        class: 'voltage',
        unit: 'V',
        states: {
          state: boardBatteryVoltage
        }
      })

      this.emitEntity({
        name: 'Spannung Eingang',
        key: 'panel_voltage',
        class: 'voltage',
        unit: 'V',
        states: {
          state: panelVoltage
        }
      })

      this.emitEntity({
        name: 'Leistung Eingang',
        key: 'panel_power',
        class: 'power',
        unit: 'W',
        states: {
          state: panelPower
        }
      })

      this.emitEntity({
        name: 'Leistung Ausgang',
        key: 'charging_power',
        class: 'power',
        unit: 'W',
        states: {
          state: chargingPower
        }
      })

      this.emitEntity({
        name: 'Ladestrom',
        key: 'charging_current',
        class: 'current',
        unit: 'A',
        states: {
          state: chargingCurrent
        }
      })

      this.emitEntity({
        name: 'Geladene Energie',
        key: 'charging_energy',
        class: 'energy',
        unit: 'kWh',
        states: {
          state: chargedEnergy
        }
      })
    }
  }
}