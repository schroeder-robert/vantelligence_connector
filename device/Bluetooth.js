import Device from './base.js'
import { spawn, spawnSync } from 'node:child_process'

export default class extends Device {
  constructor (config) {
    super(config)
    
    this.manufacturer = 'Deine Mudda'
    this.model = 'Bluetooth'
    this.version = '1'
    this.sensor = null
  }

  async connect () {
    const { connection, values } = this.config

    

    this.getPairedDevices()
  }

  async getPairedDevices () {
    const ls = spawnSync('bluetoothctl' , ['paired-devices'])
    const devices = String(ls.stdout).trim().split('\n').map(r => {
      const parts = r.split(' ')

      return {
        name: parts.slice(2).join(' '),
        address: parts[1]
      }
    })
console.log(devices)
    this.emitEntity({
      type: 'select',
      name: 'Paired devices',
      key: 'paired_devices',
      options: devices.map(d => d.name),
      commands: ['command'],
      states: { state: '' }
    })
  }

  setPairedDevices () {
    
  }
}
