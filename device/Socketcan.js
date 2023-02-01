import can from 'socketcan'
import Device from './base.js'

const STORE = {}

export default class extends Device {
  constructor (config) {
    super(config)

    this.manufacturer = '...'
    this.model = 'CAN'
    this.version = '1'
  }

  async connect () {
    const { connection } = this.config

    var channel = can.createRawChannel(connection.bus, true)

    channel.addListener('onMessage', message => {
      // console.log(message)

      STORE[message.id.toString(16)] = message.data
    })
    channel.start()


    setTimeout(() => {
      console.log(STORE)
    }, 10000)
  }
}