import { type } from 'node:os'
import Device from './base.js'
import { spawn, spawnSync } from 'node:child_process'

const spawnSyncDebug = (a, b) => {
  console.log(a, b)

  return spawnSync(a, b)
}

const ICONS = {
  computer: 'mdi:laptop',
  phone: 'mdi:cellphone',
}

export default class extends Device {
  constructor (config) {
    super(config)
    
    this.manufacturer = 'Deine Mudda'
    this.model = 'Bluetooth'
    this.version = '1'
    this.devices = []
    this.current = null
    this.selected = null
  }

  async connect () {
    this.poll(5000, () => {
      this.getAudioDevices()
      this.getConnectedDevice()
    })

    this.emitEntity({
      name: 'Status',
      key: 'status',
      states: { state: '-' }
    })

    this.emitButtons()
  }

  emitButtons () {
    const availability = this.current === null ? 'offline' : 'online'

    this.emitEntity({
      type: 'button',
      name: 'Connect',
      key: 'connect',
      icon: 'mdi:bluetooth-connect',
      availability: this.selected === null || this.selected?.address === this.current?.address ? 'offline' : 'online',
      commands: ['command'],
      states: { state: '' }
    })

    this.emitEntity({
      type: 'button',
      name: 'Disonnect',
      key: 'disconnect',
      icon: 'mdi:bluetooth-off',
      availability,
      commands: ['command'],
      states: { state: '' }
    })

    this.emitEntity({
      type: 'button',
      name: 'Media previous',
      key: 'media_previous',
      icon: 'mdi:skip-previous',
      availability,
      commands: ['command'],
      states: { state: '' }
    })

    this.emitEntity({
      type: 'button',
      name: 'Media play',
      key: 'media_play',
      icon: 'mdi:play',
      availability,
      commands: ['command'],
      states: { state: '' }
    })

    this.emitEntity({
      type: 'button',
      name: 'Media pause',
      key: 'media_pause',
      icon: 'mdi:pause',
      availability,
      commands: ['command'],
      states: { state: '' }
    })

    this.emitEntity({
      type: 'button',
      name: 'Media stop',
      key: 'media_stop',
      icon: 'mdi:stop',
      availability,
      commands: ['command'],
      states: { state: '' }
    })

    this.emitEntity({
      type: 'button',
      name: 'Media next',
      key: 'media_next',
      icon: 'mdi:skip-next',
      availability,
      commands: ['command'],
      states: { state: '' }
    })
  }

  emitDevices () {
    const options = {}

    this.devices.forEach(d => options[d.address] = d.name)
    this.emitEntity({
      type: 'select',
      name: 'Device',
      key: 'device',
      options,
      commands: ['command'],
      states: { state: this.selected?.name || '-' }
    })
  }

  getConnectedDevice () {
    const output = spawnSyncDebug('bash', ['-c', 'bluetoothctl info']).stdout
    
    if (output.toString().startsWith('Device ')) {
      this.current = this.parseDeviceInfo(output)
    } else {
      this.current = null
    }

    console.log('CURRENT', this.current?.name)

    this.emitEntity({
      name: 'Device name',
      key: 'device_name',
      states: { state: this.current?.name || '-' }
    })

    this.emitEntity({
      name: 'Device type',
      key: 'device_type',
      icon: ICONS[this.current?.icon] || 'mdi:close',
      states: { state: this.current?.icon || '-' }
    })

    this.emitEntity({
      name: 'Device address',
      key: 'device_address',
      states: { state: this.current?.address || '-' }
    })

    this.emitEntity({
      name: 'Device class',
      key: 'device_class',
      states: { state: this.current?.class || '-' }
    })

    this.emitEntity({
      name: 'Device trusted',
      key: 'device_trusted',
      type: 'binary_sensor',
      states: { state: this.current?.trusted ? 'ON' : 'OFF' }
    })

    this.emitDevices()
    this.emitButtons()
  }

  getAudioDevices () {
    this.devices = this.getPairedDevices().filter(d => 'Audio Source' in d.uuid)

    this.emitDevices()
  }

  getPairedDevices () {
    return spawnSync('bash', ['-c', 'bluetoothctl paired-devices | cut -d " " -f 2']).stdout.toString().trim().split('\n').map(a => this.getDeviceDetails(a))
  }

  getDeviceDetails (address) {
    return this.parseDeviceInfo(spawnSync('bluetoothctl' , ['info', address]).stdout)
  }

  parseDeviceInfo (content) {
    const rows = String(content).trim().split('\n\t')
    const data = { address: rows[0].split(' ')[1] }

    rows.slice(1).forEach(r => {
      let [key, value] = r.split(': ')

      if (key === 'UUID') {
        const values = data.uuid || {}
        const p = value.slice(0, -1).split(' (')

        values[p[0].trim()] = p[1].trim()

        value = values
      }

      if (value === 'yes') value = true
      if (value === 'no') value = false
      
      data[key.toLowerCase()] = value
    })

    return data
  }

  setDevice (state) {
    this.selected = this.devices.find(d => d.address === state) || null
    console.log('SET', state, this.selected?.name)
    this.emitButtons()
    this.emitDevices()
  }

  setConnect () {
    if (!this.selected?.address) return

    this.setDisconnect()

    spawnSyncDebug('bluetoothctl', ['connect', this.selected.address])
    
    this.getConnectedDevice()
  }

  setDisconnect () {
    if (!this.current?.address) return
    
    spawnSyncDebug('bluetoothctl', ['disconnect', this.current.address])

    this.getConnectedDevice()
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
    if (this.current?.address) {
      spawnSyncDebug('dbus-send', ['--system', '--type=method_call',  '--dest=org.bluez', '/org/bluez/hci0/dev_' + this.current.address.replaceAll(':', '_') + '/player0', event])
    }
  }
}
