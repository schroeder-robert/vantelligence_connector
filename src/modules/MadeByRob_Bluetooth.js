import { spawn, spawnSync } from 'node:child_process'

const ICONS = {
  computer: 'mdi:laptop',
  phone: 'mdi:cellphone',
}

const SOURCE_OPTIONS = {
  '-': '-'
}

export default ({ device, poll, stateValues, wait, config }) => {
  let sources = []
  let selected = null
  
  const bt = device('MadeByRob', 'Bluetooth', '1')
  const status = bt.sensor('status', 'Status', {}, { state: 'starting' })

  const buttonConnect = bt.button('connect', 'Connect', { icon: 'mdi:bluetooth-connect' }, { availability: 'offline', command: () => {
    // if (!this.selected?.id) return
    // console.log('!')
    //   setDisconnect()
    status.state('connecting')
    
    //   let output = ''
    
    //   for (let i = 0; i < 3; ++i) {
        const output = request('connect', selected.id)


        
        console.log('+++++++++++++++++', output.toString())
    
    //     if (output.some(r => r.startsWith('[NEW]'))) {
    //       break
    //     }
    
    //     await wait(1000)
    
    //   }
      
    //   getPlayer()
  } })

  const buttonDisconnect = bt.button('disconnect', 'Disconnect', { icon: 'mdi:bluetooth-off'}, { availability: 'offline', command: () => request('disconnect', sourceAddress.state()) })

  const sourceSelect = (state) => {
    const source = getSources().find(d => d.id === state)

    if (source) {
      selected = source
      sourceList.state(state)
      buttonConnect.availability('online')
    } else {
      selected = null
      sourceList.state('-')
      buttonConnect.availability('offline')
    }
  }

  const sourceList = bt.select('source_list', 'Source list', { options: SOURCE_OPTIONS }, { command: sourceSelect })

  sourceSelect(sourceList.state())
  
  const sourceName = bt.sensor('source_name', 'Source name')
  const sourceType = bt.sensor('source_type', 'Source type')
  const sourceAddress = bt.sensor('source_address', 'Source address')
  const sourceClass = bt.sensor('source_class', 'Source class')
  const sourceTrusted = bt.binarySensor('source_trusted', 'Source trusted')
  
  // player
  const playerStatus = bt.sensor('player_status', 'Player status')
  const playerPosition = bt.sensor('player_position', 'Player position')
  const playerDuration = bt.sensor('player_duration', 'Player duration')
  const playerArtist = bt.sensor('player_artist', 'Player artist')
  const playerTitle = bt.sensor('player_title', 'Player title')
  const playerAlbum = bt.sensor('player_album', 'Player album')
  const playerShuffle = bt.sensor('player_shuffle', 'Player shuffle')
  const playerRepeat = bt.sensor('player_repeat', 'Player repeat')
  const playerCommand = async (call) => {
    request('player.' + call)
    // await wait(500)
    //playerUpdate()
  }
  const buttons = {
    play: bt.button('player_play', 'Player play', { icon: 'mdi:play'}, { command: () => playerCommand('play') }),
    pause: bt.button('player_pause', 'Player pause', { icon: 'mdi:pause'}, { command: () => playerCommand('pause') }),
    stop: bt.button('player_stop', 'Player stop', { icon: 'mdi:stop'}, { command: () => playerCommand('stop') }),
    next: bt.button('player_next', 'Player next', { icon: 'mdi:skip-next'}, { command: () => playerCommand('next') }),
    previous: bt.button('player_previous', 'Player previous', { icon: 'mdi:skip-previous'}, { command: () => playerCommand('previous') }),
    forward: bt.button('player_fast_forward', 'Player fast forward', { icon: 'mdi:fast-forward'}, { command: () => playerCommand('fast-forward') }),
    rewind: bt.button('player_rewind', 'Player rewind', { icon: 'mdi:rewind'}, { command: () => playerCommand('rewind') }),
    repeat: bt.button('player_repeat', 'Player repeat', { icon: 'mdi:repeat'}, { command: () => playerCommand('repeat') }),
    shuffle: bt.button('player_shuffle', 'Player shuffle', { icon: 'mdi:shuffle'}, { command: () => playerCommand('shuffle') })
  }

  const playerUpdate = () => {
    if (request('player.list').length) {
      const data = parseInfo(request('player.show'))
      // console.log(data)
      const position = parseInt(data.position.split(' ')[0]) / 1000
      const duration = parseInt((data['track.duration'] || '').split(' ')[0]) / 1000

      playerStatus.state(data.status)
      playerPosition.state(Math.floor(position / 60) + ':' + String(Math.round(position % 60)).padStart(2, '0'))
      playerDuration.state(Math.floor(duration / 60) + ':' + String(Math.round(duration % 60)).padStart(2, '0'))
      playerArtist.state(data['track.artist'])
      playerTitle.state(data['track.title'])
      playerAlbum.state(data['track.album'])
      playerShuffle.state(data.shuffle)
      playerRepeat.state(data.repeat)
      status.state('connected')
      Object.values(buttons).forEach(b => b.availability('online'))
    } else {
      playerStatus.state('')
      playerPosition.state('')
      playerDuration.state('')
      playerArtist.state('')
      playerTitle.state('')
      playerAlbum.state('')
      playerShuffle.state('')
      playerRepeat.state('')
      Object.values(buttons).forEach(b => b.availability('offline'))
    }
  }

  poll(1000, () => playerUpdate())
    
  poll(5000, () => {
    const output = request('info')
// console.log(output)
    if (output[0].startsWith('Device ')) {
      const source = parseInfo(output)
// console.log(source)
      sourceName.state(source.name)
      sourceType.state(source.icon)
      sourceAddress.state(source.id)
      sourceClass.state(source.class)
      sourceTrusted.state(source.trusted === 'on' ? stateValues.on : stateValues.off)

      status.state('connected')
      // buttonConnect.availability('offline')
      buttonDisconnect.availability('online')
    } else {
      sourceName.state('')
      sourceType.state('')
      sourceAddress.state('')
      sourceClass.state('')
      sourceTrusted.state(stateValues.off)

      status.state('disconnected')
      // buttonConnect.availability('online')
      buttonDisconnect.availability('offline')
    }


    sources = getSources()
    sourceList.set('options', { ...SOURCE_OPTIONS, ...Object.fromEntries(sources.map(d => ([d.id, d.name]))) })
    sourceList.update()
    // getPlayer()
  })
}

function getPlayer () {
  let connected = false
  

  
  if (!connected) {
    host = null
    this.player = null
    setStatus('disconnected')
  }

  // console.log('CURRENT', host?.name)


}

function getSources () {
  return getDevices().filter(d => 'uuid' in d && 'Audio Source' in d.uuid)
}

function getDevices () {
  return request('devices | cut -d " " -f 2').map(id => parseInfo(request('info', id)))
}

function parseInfo (rows) {
  const data = { id: rows[0].split(' ', 2)[1] }

  rows.slice(1).forEach(r => {
    let [key, value] = r.split(': ')

    if (key === 'UUID') {
      const values = data.uuid || {}
      const p = value.slice(0, -1).split(' (')

      values[p[0].trim()] = p[1].trim()

      value = values
    }

    if (value === 'yes' || value === 'on') value = true
    if (value === 'no' || value === 'off') value = false
    
    data[key.toLowerCase()] = value
  })

  return data
}

function request () {
  const result = spawnSync('bash', ['-c', 'bluetoothctl ' + Object.values(arguments).join(' ')]).stdout.toString().trim()
  
  return result ? result.split(/\n\t?/) : []
}
