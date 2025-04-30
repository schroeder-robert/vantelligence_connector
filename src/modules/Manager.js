import fs from 'fs'

const DEVICE_OPTIONS = {
  delete: 'delete'
}

export default async ({ device, log, wait, modulePath, mqttConfig, configAdd, configRemove, getSerialDevices }) => {
  const dev = device('Vantelligence', 'Connector', '1')

  // entities
  const status = dev.sensor('status', '1. Status', { category: 'diagnostic' })
  const name = dev.text('name', '2. Name', { category: 'diagnostic' })
  const type = dev.select('type', '3. Type', { category: 'diagnostic', options: await getOptions(modulePath) })
  const button = dev.button('button', '4. Create', { category: 'diagnostic' })
  const devices = []

  const add = (id, name) => {
    const device = dev.select('device_' + id, name, { options: DEVICE_OPTIONS })

    device.command(value => {log(mqttConfig)
      switch (value) {
        case 'delete':
          configRemove(id)
          device.availability('offline')
      }
    })

    devices.push(device)
  }

  mqttConfig.forEach(m => {
    if (m) add(m.id, m.name)
  })

  // commands
  name.command(value => {
    name.state(value)
    createButtonAvailibility()
    createTypeAvailibility()
    status.state('Select type')
    log(value)
  })

  type.command(value => {
    type.state(value)
    createButtonAvailibility()
    status.state('Ready')
    log(value)
  })

  button.command(async () => {
    log(mqttConfig, typeof mqttConfig)

    if (mqttConfig.find(m => m.name === name.state())) {
      status.state(name.state() + ' already exists!')

      return
    }

    let id

    do {
      id = generateToken()
    } while (mqttConfig.find(m => m.id === id))

      configAdd({
      id,
      name: name.state(),
      type: type.state()
    })

    add(id, name.state())

    status.state('Created ' + name.state() + '!')

    await wait(3000)

    resetStates()
  })

  // functions
  const createTypeAvailibility = () => {
    log('TYPE', name.state())
    type.availability(name.state().length ? 'online' : 'offline')
    type.state('-')
  }

  const createButtonAvailibility = () => {
    log('BUTTON', name.state(), type.state())
    button.availability(name.state().length && type.state() !== '-' ? 'online' : 'offline')
  }

  const resetStates = async () => {
    name.state('')
    type.state('-')
    status.state('Enter name')
    createButtonAvailibility()
    createTypeAvailibility()
  }

  resetStates()
}

function generateToken () {
  return Array.from({ length: 8 }).map((v, i) => (p => p[Math.round(p.length * Math.random())])('0123456789ABCDEF')).join('')
}

function getOptions (path) {
  return new Promise(resolve => {
    fs.readdir(path, async (error, files) => {
      if (error) {
        return logError(error)
      }
      
      const options = {
        '-': ''
      }

      files.forEach(f => {
        const key = String(f).slice(0, f.lastIndexOf('.'))
    
        if (key === 'Manager') return

        options[key] = key
      })

      resolve(options)
    })
  })
}