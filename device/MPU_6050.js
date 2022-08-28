import i2c from 'i2c-bus'
import MPU6050 from 'i2c-mpu6050'
import Device from './base.js'

const ADDRESS = 0x68

export default class extends Device {
  constructor (config) {
    super(config)
    
    this.manufacturer = 'TDK InvenSense'
    this.model = 'MPU-6050'
    this.version = '1'
    this.sensor = null
  }

  async connect () {
    const config = this.config.connection
    const bus = i2c.openSync(parseInt(config.bus));
    
    this.sensor = new MPU6050(bus, ADDRESS)
    this.poll('requestValues', 10000, result => this.processMessage(result))
  }

  requestValues () {
    return this.sensor.readSync()
  }

  processMessage (values) {
    const temperature = Math.round(values.temp * 10) / 10
    const forceX = Math.round(values.accel.x * 100) / 100
    const forceY = Math.round(values.accel.y * 100) / 100
    const forceZ = Math.round(values.accel.z * 100) / 100
    const rotationX = Math.round(values.gyro.x * 100) / 100
    const rotationY = Math.round(values.gyro.y * 100) / 100
    const rotationZ = Math.round(values.gyro.z * 100) / 100
    const tiltX = Math.round(values.rotation.x * 1000) / 1000
    const tiltY = Math.round(values.rotation.y * 1000) / 1000

    this.emitEntity({
      name: 'Neigung X',
      key: 'tilt_x',
      unit: '°',
      states: {
        state: tiltX
      }
    })
    
    this.emitEntity({
      name: 'Neigung Y',
      key: 'tilt_y',
      unit: '°',
      states: {
        state: tiltY
      }
    })
    
    this.emitEntity({
      name: 'Temperatur',
      key: 'temperature',
      class: 'temperature',
      unit: '°C',
      states: {
        state: temperature
      }
    })
    
    this.emitEntity({
      name: 'G-Kraft X',
      key: 'force_x',
      unit: 'g',
      states: {
        state: forceX
      }
    })
    
    this.emitEntity({
      name: 'G-Kraft Y',
      key: 'force_y',
      unit: 'g',
      states: {
        state: forceY
      }
    })
    
    this.emitEntity({
      name: 'G-Kraft Z',
      key: 'force_z',
      unit: 'g',
      states: {
        state: forceZ
      }
    })
    
    this.emitEntity({
      name: 'Rotation X',
      key: 'rotation_x',
      unit: '°s',
      states: {
        state: rotationX
      }
    })
    
    this.emitEntity({
      name: 'Rotation Y',
      key: 'rotation_y',
      unit: '°s',
      states: {
        state: rotationY
      }
    })
    
    this.emitEntity({
      name: 'Rotation Z',
      key: 'rotation_z',
      unit: '°s',
      states: {
        state: rotationZ
      }
    })
  }
}