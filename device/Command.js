import Device from './base.js'
import { spawn, spawnSync } from 'node:child_process'

export default class extends Device {
  constructor (config) {
    super(config)
    
    this.manufacturer = 'Deine Mudda'
    this.model = 'Command'
    this.version = '1'
    this.sensor = null
  }

  async connect () {
    const { connection, values } = this.config

    this.poll(5000, () => this.getDisplayPower())
  }

  getDisplayPower () {
    const result = spawnSync('vcgencmd' , ['display_power'])

    this.emitEntity({
      type: 'switch',
      name: 'Display power',
      key: 'display_power',
      commands: ['command'],
      states: { state: String(result.stdout).trim().slice(14) === '1' ? 'ON' : 'OFF' }
    })
  }

  setDisplayPower (state) {
    spawnSync('vcgencmd' , ['display_power', state === 'ON' ? '1' : '0'])

    this.getDisplayPower()
  }
}
