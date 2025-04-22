import base from './base.js'
import { spawn, spawnSync } from 'node:child_process'

const ICONS = {
  computer: 'mdi:laptop',
  phone: 'mdi:cellphone',
}

export default ({ device, poll, config }) => {
  const dev = device('MadeByRob', 'Bluetooth', '1')
}

export const device = class extends base {
  constructor (config) {
    super(info, config)
    
    this.devices = []
    this.device = null
    this.player = null
    this.selected = null
    this.status = ''
  }

  async connect () {
    this.poll(5000, () => {
      this.getAudioDevices()
      this.getPlayer()
    })

    this.setStatus('start')
    this.emitButtons()
  }

  emitButtons () {
    const availability = this.device === null ? 'offline' : 'online'

    this.emitEntity({
      type: 'button',
      name: 'Connect',
      key: 'connect',
      icon: 'mdi:bluetooth-connect',
      availability: this.selected === null ? 'offline' : 'online',
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

    this.emitEntity({
      type: 'button',
      name: 'Media fast forward',
      key: 'media_fast_forward',
      icon: 'mdi:fast-forward',
      availability,
      commands: ['command'],
      states: { state: '' }
    })

    this.emitEntity({
      type: 'button',
      name: 'Media rewind',
      key: 'media_rewind',
      icon: 'mdi:rewind',
      availability,
      commands: ['command'],
      states: { state: '' }
    })
  }

  emitDevices () {
    const options = { '-': '-' }

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

  getPlayer () {
    let connected = false
    
    if (this.request('player.list').length) {
      const output = this.request('info')

      if (output[0].startsWith('Device ')) {
        this.device = this.parseDeviceInfo(output)
        this.player = this.parsePlayerInfo(this.request('player.show'))
        this.setStatus('connected')

        connected = true
      }
    }
    
    if (!connected) {
      this.device = null
      this.player = null
      this.setStatus('disconnected')
    }

    // console.log('CURRENT', this.device?.name)

    this.emitEntity({
      name: 'Device name',
      key: 'device_name',
      states: { state: this.device?.name || '-' }
    })

    this.emitEntity({
      name: 'Device type',
      key: 'device_type',
      icon: ICONS[this.device?.icon] || 'mdi:close',
      states: { state: this.device?.icon || '-' }
    })

    this.emitEntity({
      name: 'Device address',
      key: 'device_address',
      states: { state: this.device?.address || '-' }
    })

    this.emitEntity({
      name: 'Device class',
      key: 'device_class',
      states: { state: this.device?.class || '-' }
    })

    this.emitEntity({
      name: 'Device trusted',
      key: 'device_trusted',
      type: 'binary_sensor',
      states: { state: this.device?.trusted ? 'ON' : 'OFF' }
    })
    
    // console.log(this.player)

    this.emitEntity({
      name: 'Player artist',
      key: 'player_artist',
      states: { state: this.player?.artist || '-' }
    })

    this.emitEntity({
      name: 'Player title',
      key: 'player_title',
      states: { state: this.player?.title || '-' }
    })

    this.emitEntity({
      name: 'Player album',
      key: 'player_album',
      states: { state: this.player?.album || '-' }
    })

    this.emitEntity({
      name: 'Player shuffle',
      key: 'player_shuffle',
      type: 'binary_sensor',
      states: { state: this.device?.shuffle === 'on' ? 'ON' : 'OFF' }
    })

    this.emitEntity({
      name: 'Player repeat',
      key: 'player_repeat',
      type: 'binary_sensor',
      states: { state: this.device?.repeat === 'on' ? 'ON' : 'OFF' }
    })

    this.emitDevices()
    this.emitButtons()
  }

  getAudioDevices () {
    this.devices = this.getAllDevices().filter(d => 'Audio Source' in d.uuid)

    this.emitDevices()
  }

  getAllDevices () {
    return this.request('devices | cut -d " " -f 2').map(r => this.getDeviceDetails(r))
  }

  getDeviceDetails (address) {
    return this.parseDeviceInfo(this.request('info', address))
  }

  parsePlayerInfo (rows) {
    const data = {}

    rows.slice(1).forEach(r => {
      const parts = r.split(' ')

      data[parts[0][0].toLowerCase() + parts[0].slice(1).replace(/:$/, '')] = parts.slice(1).join(' ')
    })

    return data
  }

  parseDeviceInfo (rows) {
    const data = { address: rows[0].split(' ', 2)[1] }

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

  setStatus (state) {
    // console.log('STAT', state)
    this.status = state
    this.emitEntity({
      name: 'Status',
      key: 'status',
      states: { state }
    })
  }

  setDevice (state) {
    this.selected = this.devices.find(d => d.address === state) || null
    console.log('SET', state, this.selected?.name)
    this.emitButtons()
    this.emitDevices()
  }

  async setConnect () {
    if (!this.selected?.address) return
console.log('!')
    this.setDisconnect()
    this.setStatus('connecting')

    let output = ''

    for (let i = 0; i < 3; ++i) {
      output = this.request('connect', this.selected.address)
      
      console.log(output.toString())

      if (output.some(r => r.startsWith('[NEW]'))) {
        break
      }

      await this.wait(1000)

    }
    
    this.getPlayer()
  }

  setDisconnect () {
    if (!this.device?.address) return
    
    this.setStatus('disconnecting')
    this.request('disconnect', this.device.address)
    this.getPlayer()
  }

  setMediaNext () {
    this.request('player.next')
  }

  setMediaPause () {
    this.request('player.pause')
  }

  setMediaPlay () {
    this.request('player.play')
  }

  setMediaPrevious () {
    this.request('player.previous')
  }

  setMediaStop () {
    this.request('player.stop')
  }

  request () {
    const result = spawnSync('bash', ['-c', 'bluetoothctl ' + Object.values(arguments).join(' ')]).stdout.toString().trim()
    
    return result ? result.split(/\n\t?/) : []
  }
}
