import Device from './base.js'
import { PulseAudio, percentToVolume, volumeToPercent, dBToVolume, volumeTodB } from 'pulseaudio.js'

const DB_MIN = -130

export default class extends Device {
  constructor (config) {
    super(config)

    this.manufacturer = 'Raspberry Pi'
    this.model = 'Volume'
    this.version = '1'
    this.client = null
  }

  async connect () {
    this.client = new PulseAudio();

    await this.client.connect()
    
    this.poll('getSinks', 5000)
  }

  async getSinks () {
    const server = await this.client.getServerInfo()
    const sinks = await this.client.getAllSinks()
    const options = {}

    sinks.forEach(sink => {
      options[sink.name] = sink.description

      if (server.defaultSink === sink.name) {
        const db = volumeTodB(sink.volume.current[0]).toFixed(1)

        this.emitVolumeDb(db < DB_MIN ? DB_MIN : db)
        this.emitVolumePercent(volumeToPercent(sink.volume.current[0]).toFixed(0))
        this.emitMute(sink.mute ? 'ON' : 'OFF')
      }
    })

    this.emitEntity({
      type: 'select',
      name: 'Sink',
      key: 'sink',
      options,
      commands: ['command'],
      states: { state: options[server.defaultSink] }
    })
  }

  emitVolumePercent (state) {
    this.emitEntity({
      type: 'number',
      name: 'Volume percent',
      key: 'volume_percent',
      min: 0,
      max: 100,
      step: 1,
      commands: ['command'],
      states: { state }
    })
  }

  emitVolumeDb (state) {
    this.emitEntity({
      type: 'number',
      name: 'Volume dB',
      key: 'volume_db',
      min: DB_MIN,
      max: 0,
      step: 0.1,
      class: 'sound_pressure',
      unit: 'dB',
      commands: ['command'],
      states: { state }
    })
  }

  emitMute (state) {
    this.emitEntity({
      type: 'switch',
      name: 'Mute',
      key: 'mute',
      commands: ['command'],
      states: { state }
    })
  }

  async handle (control, state, value) {
    if (control === 'volume_percent') {
      this.client.setSinkVolume(percentToVolume(value))
      
      this.emitVolumePercent(value)
    } else if (control === 'volume_db') {
      if (value <= DB_MIN) value = -Infinity
      this.log('SET', value)
      this.client.setSinkVolume(dBToVolume(value))
      
      this.emitVolumePercent(value)
    } else if (control === 'mute') {
      this.client.setSinkMute(value === 'ON')
      
      this.emitMute(value)
    } else if (control === 'sink') {
      const sinks = await this.client.getAllSinks()
      const sink = sinks.find(sink => sink.name === value)

      if (sink) {
        this.client.setDefaultSink(sink.name)
      }
    }

    this.getSinks()
  }
}