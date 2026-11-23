// import http from 'http'

// const host = 'localhost'
// const port = 8008

// const server = http.createServer();
// server.listen(port, host, () => {
//   console.log(`Server is running on http://${host}:${port}`)
// })

import { ByteLengthParser } from '@serialport/parser-byte-length'
import { execFile, execFileSync } from 'node:child_process'
import { poll, wait, convertKeyToMethod, convertNameToKey, createSerialConnection, getSerialDevices, log, logError } from './helpers.js'
import * as mod from './modules/WirePlumber.js'
import * as maps from './maps.js'

console.log('ok')

function entity () {
  console.log('ENTITY', Object.values(arguments))

  return {
    state: function () {
      console.log('ENTITY STATE', Object.values(arguments))
    },
    command: function () {
      console.log('ENTITY COMMAND', Object.values(arguments))
    }
  }
}

// mod({
//   ...maps,
//   device: () => ({
//     number: entity,
//     button: entity,
//     select: entity,
//     switch: entity
//   }),
//   on: function () {
//     console.log('ON', Object.values(arguments))
//   },
//   prop: function () {
//     console.log('PROP', Object.values(arguments))

//     return {}
//   },
//   log,
//   logError,
//   poll: function (time, method, interval) {
//     return poll('DEBUG', time, () => { log('POLL'); method() }, interval)
//   }
// })

// for (let i = 0; i < 40; i++) {
//   //mod.run('set-volume', mod.DEFAULT_SINK, '2%-')
//   execFile('amixer', ['sset', 'Master', i * 1000])
//   console.log(i * 1000)
//   await wait(100)
// }

const sendSerial = createSerialConnection(
  'DEBUG',
  { path: '/dev/serial/by-path/platform-fd500000.pcie-pci-0000:01:00.0-usb-0:1.1.1.2:1.0-port0', baudRate: 9600 },
  null,
  (buffer) => {
    console.log('RESPONSE', buffer)
  }
)

setTimeout(() => {
  sendSerial([0x01]).then((x) => {
    console.log('SENT', x)
  })
}, 1500)

setTimeout(() => {
  sendSerial([0x00]).then((x) => {
    console.log('SENT', x)
  })
}, 10000)