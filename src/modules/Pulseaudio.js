import { PulseAudio, percentToVolume, volumeToPercent, dBToVolume, volumeTodB } from 'pulseaudio.js'

const DB_MIN = -130
const ICONS = {
  volumeHigh: 'mdi:volume-high',
  volumeMedium: 'mdi:volume-medium',
  volumeLow: 'mdi:volume-low',
  volumeMute: 'mdi:volume-mute'
}

export default async ({ device, poll, on, prop, log, logError }) => {
  const dev = device('Raspberry Pi', 'Pulseaudio', '1')
  const connection = prop('connection', { socket: '/run/audio/pulse.sock' })
  
  try {
    const client = new PulseAudio(undefined, undefined, connection.socket)

    await client.connect()
    
    const mute = dev.switch('mute', 'Mute', { icon: ICONS.volumeMute })
    const volumeDb = dev.number('volume_db', 'Volume dB', { min: DB_MIN, max: 0, step: 0.1, class: 'sound_pressure', unit: 'dB' })
    const volumePercent = dev.number('volume_percent', 'Volume percent', { min: 0, max: 100, step: 1 })
    const sink = dev.select('sink', 'Sink')

    const muteCommand = value => {
      client.setSinkMute(value === 'ON')
      mute.state(value)
      volumePercent.set('icon', volumeIcon(volumePercent.state(), value === 'ON'))
      volumePercent.update()
    }
    mute.command(muteCommand)

    const volumePercentCommand = value => {
      client.setSinkVolume(percentToVolume(value))
      volumePercent.state(value)
      volumePercent.set('icon', volumeIcon(value, mute.state()))
      volumePercent.update()
    }
    volumePercent.command(volumePercentCommand)
    
    volumeDb.command(value => {
      if (value < DB_MIN) value = DB_MIN

      client.setSinkVolume(dBToVolume(value))
      volumePercent.state(value)
    })

    sink.command(value => {
      client.setDefaultSink(value)
      sink.state(value)
    })

    on('mute', muteCommand)
    on('volume_down', value => {
      if (value === 'ON') volumePercentCommand(parseInt(volumePercent.state()) - 2)
    })
    on('volume_up', value => {
      if (value === 'ON') volumePercentCommand(parseInt(volumePercent.state()) + 2)
    })
    
    poll(5000, async () => {
      const server = await client.getServerInfo()
      const sinks = await client.getAllSinks()
      const options = {}
    
      sinks.forEach(sink => {
        options[sink.name] = sink.description
    
        if (server.defaultSink === sink.name) {
          mute.state(sink.mute)

          const db = volumeTodB(sink.volume.current[0]).toFixed(1)
          volumeDb.state(db < DB_MIN ? DB_MIN : db)

          const percent = volumeToPercent(sink.volume.current[0]).toFixed(0)
          volumePercent.state(percent)
          volumePercent.set('icon', volumeIcon(percent, sink.mute))
          volumePercent.update()
        }
      })

      sink.state(options[server.defaultSink])
      sink.set('options', options)
      sink.update()
    })
  } catch (error) {
    logError(error)
  }
}

function volumeIcon (value, mute) {
  let icon = ICONS.volumeHigh

  if (mute) {
    icon = ICONS.volumeMute
  } else if (value < 20) {
    icon = ICONS.volumeLow
  } else if (value < 50) {
    icon = ICONS.volumeMedium
  }

  return icon
}