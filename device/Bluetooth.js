import Device from './base.js'
import { spawn, spawnSync } from 'node:child_process'

export default class extends Device {
  constructor (config) {
    super(config)
    
    this.manufacturer = 'Deine Mudda'
    this.model = 'Bluetooth'
    this.version = '1'
    this.selected = null
  }

  async connect () {
    const current = this.getConnectedDevice()
    const devices = this.getPairedDevices()

    this.emitEntity({
      type: 'switch',
      name: 'Connect',
      key: 'connect',
      commands: ['command'],
      states: { state: '' }
    })

    this.emitEntity({
      type: 'switch',
      name: 'Media previous',
      key: 'media_previous',
      commands: ['command'],
      states: { state: '' }
    })

    this.emitEntity({
      type: 'switch',
      name: 'Media play',
      key: 'media_play',
      commands: ['command'],
      states: { state: '' }
    })

    this.emitEntity({
      type: 'switch',
      name: 'Media pause',
      key: 'media_pause',
      commands: ['command'],
      states: { state: '' }
    })

    this.emitEntity({
      type: 'switch',
      name: 'Media stop',
      key: 'media_stop',
      commands: ['command'],
      states: { state: '' }
    })

    this.emitEntity({
      type: 'switch',
      name: 'Media next',
      key: 'media_next',
      commands: ['command'],
      states: { state: '' }
    })

    this.emitEntity({
      type: 'select',
      name: 'Paired devices',
      key: 'paired_devices',
      options: devices.map(d => d.name),
      commands: ['command'],
      states: { state: devices.findIndex(d => d.address === current) }
    })
  }

  getConnectedDevice () {
    return String(spawnSync('bash', ['-c', 'bluetoothctl info | grep "Device " | cut -d " " -f 2']).stdout).trim()
  }

  getPairedDevices () {
    const ls = spawnSync('bluetoothctl' , ['paired-devices'])
    
    return String(ls.stdout).trim().split('\n').map(r => {
      const parts = r.split(' ')

      return {
        name: parts.slice(2).join(' '),
        address: parts[1]
      }
    })
  }

  setPairedDevices (state) {
    this.selected = this.getPairedDevices()[state]

    this.emitEntity({
      name: 'Connected',
      key: 'connected',
      states: { state: this.selected.name }
    })
  }

  setConnect (state) {
    //console.log(state, this.selected)

    if (this.selected) {
      const params = [state === 'ON' ? 'connect' : 'disconnect', this.selected.address]
      console.log('bluetoothctl', params)
      console.log(String(spawnSync('bluetoothctl', params).stdout))
    }
  }

  setMediaNext () {
    this.dbusSend('org.bluez.MediaPlayer1.Next')
  }

  setMediaPause () {
    this.dbusSend('org.bluez.MediaPlayer1.Pause')
  }

  setMediaPlay () {
    this.dbusSend('org.bluez.MediaPlayer1.Play')
  }

  setMediaPrevious () {
    this.dbusSend('org.bluez.MediaPlayer1.Previous')
  }

  setMediaStop () {
    this.dbusSend('org.bluez.MediaPlayer1.Stop')
  }
  
  dbusSend (event) {
    if (this.selected) {
      spawnSync('dbus-send', ['--system', '--type=method_call',  '--dest=org.bluez', '/org/bluez/hci0/dev_' + this.selected.address.replaceAll(':', '_') + '/player0', event])
    }
  }
}
