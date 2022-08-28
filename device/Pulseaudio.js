import Device from './base.js'
import { exec } from 'child_process'
import { PulseAudio, percentToVolume, volumeToPercent } from 'pulseaudio.js'

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

    sinks.forEach(sink => {
      this.emitEntity({
        type: 'switch',
        name: sink.description,
        key: 'sink_' + sink.name.replace(/\W/g, '_'),
        commands: ['command'],
        states: {
          state: server.defaultSink === sink.name ? 'ON' : 'OFF'
        }
      })

      if (server.defaultSink === sink.name) { 
        this.emitVolume(Math.round(sink.volume.current[0] / (sink.volume.steps - 1) * 100), !!sink.mute)
      }
    })
  }

  emitVolume (level, mute) {
    this.emitEntity({
      type: 'light',
      name: 'Volume',
      key: 'volume',
      brightness: true,
      brightnessScale: 100,
      commands: ['command'],
      states: {
        state: JSON.stringify({
          state: mute ? 'OFF' : 'ON',
          brightness: level
        })
      }
    })
  }

  async handle (control, state, value) {
    if (control === 'volume') {
      value = JSON.parse(value)

      this.client.setSinkMute(value.state === 'OFF')

      if (value.brightness) {
        this.client.setSinkVolume(percentToVolume(value.brightness))
      }

      this.emitVolume(value.brightness, value.state === 'OFF')
    } else if (control.slice(0, 5) === 'sink_') {
      const sinks = await this.client.getAllSinks()
      const sink = sinks.find(sink => control.slice(5) === sink.name.replace(/\W/g, '_'))

      this.client.setDefaultSink(sink.name)
      this.getSinks()
    }
  }
}