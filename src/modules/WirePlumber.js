import { spawn, spawnSync } from 'node:child_process'

const DEFAULT_SINK = '@DEFAULT_AUDIO_SINK@'

export default ({ device, poll, prop, on, stateValues, entityClasses, entityUnits }) => {
  const wp = device('wireplumber', 'WirePlumber')
  const volume = wp.number('volume', 'Volume', { icon: 'mdi:volume-high', min: 0, max: 100, step: 1, class: entityClasses.volume, unit: entityUnits.percent }, { command: (state) => setVolume(state) })
  const mute = wp.switch('mute', 'Mute', { icon: 'mdi:volume-off' }, { command: (state) => setMute(state) })
  
  wp.button('volume_down', 'Volume Down', { icon: 'mdi:volume-minus' }, { command: () => changeVolume('2%-') })
  wp.button('volume_up', 'Volume Up', { icon: 'mdi:volume-plus' }, { command: () => changeVolume('2%+') })
  wp.button('test', 'Test Sound', { icon: 'mdi:speaker' }, { command: () => runTest() })
  wp.button('toggle', 'Toggle', { icon: 'mdi:volume-off' }, { command: () => toggleMute() })

  const getVolume = () => {
    const data = request('get-volume', DEFAULT_SINK)[0].split(' ')

    return { volume: parseFloat(data[1]), mute: !!data[2] }
  }
  
  const setVolume = (value) => {
    request('set-volume', DEFAULT_SINK, parseInt(value) / 100)
    volume.state(value)
  }
  
  const changeVolume = (value) => {
    request('set-volume', DEFAULT_SINK, value)
    volume.state(getVolume().volume * 100)
  }
  
  const setMute = (state) => {
    request('set-mute', DEFAULT_SINK, state === stateValues.on ? 1 : 0)
    mute.state(state)
  }

  const toggleMute = () => {
    request('set-mute', DEFAULT_SINK, 'toggle')
    mute.state(getVolume().mute ? stateValues.on : stateValues.off)
  }

  on('mute', () => {
    if (value === stateValues.on) toggleMute()
  })

  on('volume_down', value => {
    if (value === stateValues.on) changeVolume('2%-')
  })
  on('volume_up', value => {
    if (value === stateValues.on) changeVolume('2%+')
  })

  poll(1000, () => {
    const info = getVolume(DEFAULT_SINK)

    volume.state(info.volume * 100)
    mute.state(info.mute ? stateValues.on : stateValues.off)
  })
}

function runTest () {
  spawnSync('paplay', ['/usr/share/sounds/freedesktop/stereo/complete.oga'])
}

function status () {
  const result = request('status')
  const data = {}

  let key = null
  let sub = null

  result.forEach(line => {
    if (line.slice(0, 1).trim()) {
      const parts = line.trim().split(' ')

      key = data[parts[0].toLowerCase()] = {}

      if (parts.length > 1) {
        key.info = parts.slice(1).join(' ')
      }
    } else {
      if (line.slice(2, 3).trim()) {
        sub = key[line.slice(4, -1).toLowerCase()] = []
      } else {
        const value = line.slice(7).trim()

        if (!value) return
        
        const matches = value.match(/^(\d+)\.\s+(.+?)(?:\s+\[(.+)\])?$/)

        sub.push({
          id: parseInt(matches[1]),
          line: matches[2],
          extra: matches[3],
          default: !!line.slice(4, 5).trim()
        })
      }
    }
  })

  return data
}

function request () {
  const result = spawnSync('wpctl', Object.values(arguments)).stdout.toString().trim()
  
  return result ? result.split(/\n\t?/) : []
}