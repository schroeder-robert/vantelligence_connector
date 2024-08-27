import Device from './base.js'

const ERROR_PROCESS_MESSAGE = 'Cannot process info message: '

export default class extends Device {
  constructor (config) {
    super(config)
    
    this.manufacturer = 'Votronic'
    this.model = 'VCC 1212-30'
    this.version = '1'
  }

  async connect () {
    const { connection } = this.config

    if (connection.type !== 'serial') {
      return 'Connection type not supported!'
    }

    this.createSerialConnection({ path: connection.port, baudRate: 1000 }, null, buffer => this.processMessage(buffer))
  }

  processMessage (buffer) {
    if (buffer.length < 8) return

    let data = {}

    try {
      if (buffer.length < 8) {
        throw new Error('Buffer too short')
      }

      data.voltageBoard = buffer.readInt16LE(2) / 100
      data.voltageStart = buffer.readInt16LE(4) / 100
      data.currentBoard = buffer.readInt16LE(6) / 10
    } catch (e) {
      this.error(ERROR_PROCESS_MESSAGE + e)
    }
    
    if (data.voltageStart > 10 && data.voltageStart < 20) {
      this.emitEntity({
        name: 'Spannung Starterbatterie',
        key: 'voltage_start_battery',
        class: 'voltage',
        unit: 'V',
        states: {
          state: data.voltageStart
        }
      })
    }
    
    if (data.voltageBoard > 10 && data.voltageBoard < 20) {
      this.emitEntity({
        name: 'Spannung Bordbatterie',
        key: 'voltage_board_battery',
        class: 'voltage',
        unit: 'V',
        states: {
          state: data.voltageBoard
        }
      })
    }
    
    if (data.currentBoard < 50) {
      this.emitEntity({
        name: 'Ladestrom Bordbatterie',
        key: 'current_board_battery',
        class: 'current',
        unit: 'A',
        states: {
          state: data.currentBoard
        }
      })
    }
  }
}