import SerialPort from 'serialport'
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

    this.port = new SerialPort(connection.port, {
      baudRate: 1000,
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
      }, 100)
    })
  }

  disconnect () {
    this.port.close()
  }

  decodeBytes (buffer) {
    const values = []

    for (let i = 0; i < buffer.length; i += 2) {
      values.push((buffer[i + 1] << 8) | buffer[i])
    }

    return values
  }

  processMessage (buffer) {
    const values = this.decodeBytes(buffer)

    if (!values) {
      return
    }

    const voltageBoard = values[1] / 100
    const voltageStart = values[2] / 100
    const currentBoard = values[3] / 10
    
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