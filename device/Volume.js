import Device from './base.js'
import { exec } from 'child_process'

let USER = 'root'

export default class extends Device {
  constructor (config) {
    super(config)

    this.manufacturer = 'Raspberry Pi'
    this.model = 'Volume'
    this.version = '1'
  }

  connect () {
    return new Promise(resolve => {
      exec('who | grep :0', (error, stdout, stderr) => {
        if (error === null) {
          USER = stdout.slice(0, stdout.indexOf(' '))

          this.poll('readControls', 5000)

          resolve()
        } else {
          resolve(error.toString())
        }
      })
    })
  }

  readControls () {
    if (this.config.controls instanceof Array) {
      this.config.controls.forEach(control => {
        const command = ['su', USER, '-c', 'amixer']

        if (typeof control.card === 'number') {
          	command.push('-c', control.card)
        }

        command.push('get', control.id)
// console.log(command.join(' '))
        exec(command.join(' '), (error, stdout, stderr) => {
          if (error === null) {
            this.processControl(control, stdout)
          } else {
            this.log(error, '⚠️')
          }
        })
      })
    }
  }

  parseControls (data) {
    const controls = []

    data.trim().split('\n').forEach(line => {
      if (line.slice(0, 2).trim()) {
        const result = line.slice(21).split(',')

        controls.push({
          'Name': result[0].replace(/^'/, '').replace(/'$/, ''),
          'Id': result[1]
        })
      } else {
        const result = line.trim().match(/^([^:]+)\: (.*)$/)

        if (result) {
          const [all, key, value] = result
          const control = controls[controls.length - 1]
          if (key === 'Capabilities') {
            control[key] = value.split(' ')
          } else if (key === 'Items') {
            control[key] = value.split(' ').map(item => item.replace(/^'/, '').replace(/'$/, ''))
          } else if (key === 'Item0') {
            control[key] = value.replace(/^'/, '').replace(/'$/, '')
          } else {
            control[key] = value
          }
        }
      }
    })
    
    return controls
  }

  processControl (config, data) {// console.log(config, data)
    const controls = this.parseControls(data)
    const control = controls.find(item => item['Name'] === config.id)

    if (control) {
      const key = this.convertNameToKey(config.name)

      if (control['Capabilities']) {
        if (control['Capabilities'].includes('enum')) {
          this.emitEntity({
            type: 'select',
            name: config.name + ' Enum',
            key: key + '_select',
            options: control['Items'],
            commands: ['command'],
            states: {
              state: control['Item0']
            }
          })
        }
      }

      if (control['Limits'].indexOf('Playback') >= 0) {
        let volume = 0
        let mute = 'OFF'

        control['Playback channels'].split(' - ').forEach(channel => {
          const values = control[channel].match(/Playback (\d+) \[([0-9]+)%\] \[([\.\-0-9]+)dB\] \[(on|off)\]/)

          if (values) {
            volume = Math.max(volume, values[2])
            mute = values[4] === 'off' ? 'ON' : mute
          }
        })

        if (control['Capabilities']) {
          if (control['Capabilities'].includes('pswitch')) {
            this.emitEntity({
              type: 'switch',
              name: config.name + ' Playback Mute',
              key: key + '_playback_mute',
              commands: ['command'],
              states: {
                state: mute
              }
            })
          }

          if (control['Capabilities'].includes('pvolume')) {
            this.emitEntity({
              type: 'number',
              name: config.name + ' Playback Volume',
              key: key + '_playback_volume',
              min: 0,
              max: 100,
              commands: ['command', 'increase', 'decrease'],
              states: {
                state: volume
              }
            })
          }
        }
      }

      if (control['Limits'].indexOf('Capture') >= 0) {
        let volume = 0
        let mute = 'OFF'

        control['Capture channels'].split(' - ').forEach(channel => {
          const values = control[channel].match(/Capture (\d+) \[([0-9]+)%\] \[([\.\-0-9]+)dB\] \[(on|off)\]/)

          if (values) {
            volume = Math.max(volume, values[2])
            mute = values[4] === 'off' ? 'ON' : mute
          }
        })

        if (control['Capabilities']) {
          if (control['Capabilities'].includes('cswitch')) {
            this.emitEntity({
              type: 'switch',
              name: config.name + ' Capture Mute',
              key: key + '_capture_mute',
              commands: ['command'],
              states: {
                state: 'OFF'
              }
            })
          }

          if (control['Capabilities'].includes('cvolume')) {
            this.emitEntity({
              type: 'number',
              name: config.name + ' Capture Volume',
              key: key + '_capture_volume',
              min: 0,
              max: 100,
              commands: ['command', 'increase', 'decrease'],
              states: {
                state: 5
              }
            })
          }
        }
      }
    } else {
      this.log('Control not found: "' + config.id + '"', '⚠️')
    }
  }

  async handle (control, state, value) {
    const [name, type, property] = control.split('_')
    
    control = this.config.controls.find(control => String(control.name).toLowerCase() === name)
    
    const command = ['amixer']

    if (typeof control.card === 'number') {
      command.push('-c', control.card)
    }

    command.push('set', control.id)
  
    if (control) {
      if (property === 'volume') {
        if (state === 'command') {
          command.push(value + '%')
        } else if (state === 'increase') {
          command.push(value + '%+')
        } else if (state === 'decrease') {
          command.push(value + '%-')
        }
      } else if (property === 'mute') {
        if (state === 'command') {
          command.push(value === 'ON' ? 'mute' : 'unmute')
        }
      }

      exec(command.join(' '), (error, stdout, stderr) => {
        if (error === null) {
          this.processControl(control, stdout)
        } else {
          this.log(error, '⚠️')
        }
      })
    }
  }
}