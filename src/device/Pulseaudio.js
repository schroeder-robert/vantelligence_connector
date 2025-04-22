import base from './base.js'
import { PulseAudio, percentToVolume, volumeToPercent, dBToVolume, volumeTodB } from 'pulseaudio.js'

const DB_MIN = -130
const ICONS = {
  volumeHigh: 'mdi:volume-high',
  volumeMedium: 'mdi:volume-medium',
  volumeLow: 'mdi:volume-low',
  volumeMute: 'mdi:volume-mute'
}

export const info = {
  manufacturer: 'Raspberry Pi',
  model: 'Pulseaudio',
  version: '1'
}

export const device = class extends base {
  constructor (config) {
    super(info, config)

    this.client = null
  }

  async connect () {
    try {
      this.client = new PulseAudio(undefined, undefined, '/run/audio/pulse.sock')

      await this.client.connect()
      
      this.poll(5000, () => this.getSinks())
    } catch (error) {
      this.error(error)
    }
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
        this.emitVolumePercent(volumeToPercent(sink.volume.current[0]).toFixed(0), sink.mute)
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

  emitVolumePercent (state, mute) {
    let icon = ICONS.volumeHigh

    if (mute) {
      icon = ICONS.volumeMute
    } else if (state < 20) {
      icon = ICONS.volumeLow
    } else if (state < 50) {
      icon = ICONS.volumeMedium
    }


    this.emitEntity({
      type: 'number',
      name: 'Volume percent',
      key: 'volume_percent',
      icon,
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
      icon: ICONS.volumeMute,
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