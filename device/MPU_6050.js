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

    try {
      const bus = i2c.openSync(parseInt(connection.bus));
      
      this.sensor = new MPU6050(bus, ADDRESS)
    } catch (error) {
      this.restart()

      throw error
    }

    this.poll(1000, async () => {
      let sumX = 0
      let sumY = 0
      let data = null
      const samples = 10

      try {
        for (let i = 0; i < samples; ++i) {
          data = this.sensor.readSync()
          
          sumX += data.rotation.x
          sumY += data.rotation.y

          await this.wait(1000 / samples)
        }

        data.rotation.x = sumX / samples
        data.rotation.y = sumY / samples

        this.processMessage(data)
      } catch (error) {
        console.log('SHIT', error.message)

        this.restart()

        throw error
      }
    })
  }

  restart () {
    setTimeout(() => this.connect(), 3000)
  }

  processMessage (values) {
    if ('temp' in values) { 
      this.emitEntity({
        name: 'Temperatur',
        key: 'temperature',
        class: 'temperature',
        unit: '°C',
        states: {
          state: values.temp.toFixed(1)
        }
      })
    }

    if ('x' in values?.rotation) { 
      this.emitEntity({
        name: 'Neigung X',
        key: 'tilt_x',
        unit: '°',
        states: {
          state: values.rotation.x.toFixed()
        }
      })
    }

    if ('y' in values?.rotation) { 
      this.emitEntity({
        name: 'Neigung Y',
        key: 'tilt_y',
        unit: '°',
        states: {
          state: values.rotation.y.toFixed()
        }
      })
    }

    if ('x' in values?.accel) { 
      this.emitEntity({
        name: 'G-Kraft X',
        key: 'force_x',
        unit: 'g',
        states: {
          state: Math.round(values.accel.x * 100) / 100
        }
      })
    }

    if ('y' in values?.accel) { 
      this.emitEntity({
        name: 'G-Kraft Y',
        key: 'force_y',
        unit: 'g',
        states: {
          state: Math.round(values.accel.y * 100) / 100
        }
      })
    }

    if ('z' in values?.accel) { 
      this.emitEntity({
        name: 'G-Kraft Z',
        key: 'force_z',
        unit: 'g',
        states: {
          state: Math.round(values.accel.z * 100) / 100
        }
      })
    }

    if ('x' in values?.gyro) { 
      this.emitEntity({
        name: 'Rotation X',
        key: 'rotation_x',
        unit: '°s',
        states: {
          state: Math.round(values.gyro.x * 100) / 100
        }
      })
    }

    if ('y' in values?.gyro) { 
      this.emitEntity({
        name: 'Rotation Y',
        key: 'rotation_y',
        unit: '°s',
        states: {
          state: Math.round(values.gyro.y * 100) / 100
        }
      })
    }

    if ('z' in values?.gyro) { 
      this.emitEntity({
        name: 'Rotation Z',
        key: 'rotation_z',
        unit: '°s',
        states: {
          state: values.gyro.z
        }
      })
    }
  }
}