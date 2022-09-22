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
    const { connection } = this.config
    const bus = i2c.openSync(parseInt(connection.bus));
    
    this.sensor = new MPU6050(bus, ADDRESS)
    this.poll('requestValues', 10000, result => this.processMessage(result))
  }

  requestValues () {
    try {
      return this.sensor.readSync()
    } catch (error) {
      this.warning(error)
    }
  }

  processMessage (values) {
    if (values?.temp) { 
      this.emitEntity({
        name: 'Temperatur',
        key: 'temperature',
        class: 'temperature',
        unit: '°C',
        states: {
          state: Math.round(values.temp * 10) / 10
        }
      })
    }

    if (values?.rotation?.x) { 
      this.emitEntity({
        name: 'Neigung X',
        key: 'tilt_x',
        unit: '°',
        states: {
          state: Math.round(values.rotation.x * 1000) / 1000
        }
      })
    }

    if (values?.rotation?.y) { 
      this.emitEntity({
        name: 'Neigung Y',
        key: 'tilt_y',
        unit: '°',
        states: {
          state: Math.round(values.rotation.y * 1000) / 1000
        }
      })
    }

    if (values?.accel?.x) { 
      this.emitEntity({
        name: 'G-Kraft X',
        key: 'force_x',
        unit: 'g',
        states: {
          state: Math.round(values.accel.x * 100) / 100
        }
      })
    }

    if (values?.accel?.y) { 
      this.emitEntity({
        name: 'G-Kraft Y',
        key: 'force_y',
        unit: 'g',
        states: {
          state: Math.round(values.accel.y * 100) / 100
        }
      })
    }

    if (values?.accel?.z) { 
      this.emitEntity({
        name: 'G-Kraft Z',
        key: 'force_z',
        unit: 'g',
        states: {
          state: Math.round(values.accel.z * 100) / 100
        }
      })
    }

    if (values?.gyro?.x) { 
      this.emitEntity({
        name: 'Rotation X',
        key: 'rotation_x',
        unit: '°s',
        states: {
          state: Math.round(values.gyro.x * 100) / 100
        }
      })
    }

    if (values?.gyro?.y) { 
      this.emitEntity({
        name: 'Rotation Y',
        key: 'rotation_y',
        unit: '°s',
        states: {
          state: Math.round(values.gyro.y * 100) / 100
        }
      })
    }

    if (values?.gyro?.z) { 
      this.emitEntity({
        name: 'Rotation Z',
        key: 'rotation_z',
        unit: '°s',
        states: {
          state: Math.round(values.gyro.z * 100) / 100
        }
      })
    }
  }
}