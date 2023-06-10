import { SerialPort } from 'serialport'
import { InterByteTimeoutParser } from '@serialport/parser-inter-byte-timeout'
import Device from './base.js'

export default class extends Device {
  constructor (config) {
    super(config)
    
    this.manufacturer = 'Votronic'
    this.model = 'VCC 1212-30'
    this.version = '1'
    this.buffer = []
    this.timeout = null
    this.port = null
  }

  async connect () {
    const { connection } = this.config

    if (connection.type !== 'serial') {
      return 'Connection type not supported!'
    }

    this.port = new SerialPort({
      path: connection.port,
      baudRate: 1000,
      autoOpen: false
    })

    this.port.open(error => {
      return error ? error.message : true
    })

    const parser = this.port.pipe(new InterByteTimeoutParser({ interval: 100 }))

    parser.on('data', data => this.processMessage(data))
  }

  disconnect () {
    this.port.close()
  }

  processMessage (buffer) {
    if (buffer.length < 8) return

    const voltageBoard = buffer.readInt16LE(2) / 100
    const voltageStart = buffer.readInt16LE(4) / 100
    const currentBoard = buffer.readInt16LE(6) / 10
    
    if (voltageStart > 10 && voltageStart < 20) {
      this.emitEntity({
        name: 'Spannung Starterbatterie',
        key: 'voltage_start_battery',
        class: 'voltage',
        unit: 'V',
        states: {
          state: voltageStart
        }
      })
    }
    
    if (voltageBoard > 10 && voltageBoard < 20) {
      this.emitEntity({
        name: 'Spannung Bordbatterie',
        key: 'voltage_board_battery',
        class: 'voltage',
        unit: 'V',
        states: {
          state: voltageBoard
        }
      })
    }
    
    if (currentBoard < 50) {
      this.emitEntity({
        name: 'Ladestrom Bordbatterie',
        key: 'current_board_battery',
        class: 'current',
        unit: 'A',
        states: {
          state: currentBoard
        }
      })
    }
  }
}