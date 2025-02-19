import i2c from 'i2c-bus'
import MPU6050 from 'i2c-mpu6050'
import Device from './base.js'
import KalmanFilter from 'kalmanjs'

export default class extends Device {
  constructor (config) {
    super(config)
    
    this.manufacturer = 'TDK InvenSense'
    this.model = 'MPU-6050'
    this.version = '1'
    this.sensor = null
    this.filters = {
      rotationX: new KalmanFilter({ R: 0.01, Q: 1 }),
      rotationY: new KalmanFilter({ R: 0.01, Q: 1 }),
      accelX: new KalmanFilter({ R: 0.01, Q: 3 }),
      accelY: new KalmanFilter({ R: 0.01, Q: 3 }),
      accelZ: new KalmanFilter({ R: 0.01, Q: 3 }),
      gyroX: new KalmanFilter({ R: 0.01, Q: 3 }),
      gyroY: new KalmanFilter({ R: 0.01, Q: 3 }),
      gyroZ: new KalmanFilter({ R: 0.01, Q: 3 }),
      temp: new KalmanFilter({ R: 0.01, Q: 3 })
    }
  }

  async connect () {
    const { connection } = this.config

    try {
      const bus = i2c.openSync(parseInt(connection.bus));
      
      this.sensor = new MPU6050(bus, connection.address || 0x68)
    } catch (error) {
      this.restart()

      throw error
    }

    this.poll(500, async () => this.getValues())
  }

  restart () {
    setTimeout(() => this.connect(), 3000)
  }

  async getValues () {
    const samples = 3
    let data = null
    let rotationX = 0
    let rotationY = 0
    let accelX = 0
    let accelY = 0
    let accelZ = 0
    let gyroX = 0
    let gyroY = 0
    let gyroZ = 0
    let temp = 0

    // console.log('-')

    try {        
      for (let i = 0; i < samples; ++i) {
        data = this.sensor.readSync()

        rotationX = this.filters.rotationX.filter(data.rotation.x)
        rotationY = this.filters.rotationY.filter(data.rotation.y)
        accelX = this.filters.accelX.filter(data.accel.x)
        accelY = this.filters.accelY.filter(data.accel.y)
        accelZ = this.filters.accelZ.filter(data.accel.z)
        gyroX = this.filters.gyroX.filter(data.gyro.x)
        gyroY = this.filters.gyroY.filter(data.gyro.y)
        gyroZ = this.filters.gyroZ.filter(data.gyro.z)
        temp = this.filters.temp.filter(data.temp)

        await this.wait(500 / samples)
      }

      this.emitEntity({
        name: 'Temperatur',
        key: 'temperature',
        class: 'temperature',
        unit: '°C',
        states: {
          state: temp.toFixed(1)
        }
      })
      
      this.emitEntity({
        name: 'Neigung X',
        key: 'tilt_x',
        unit: '°',
        states: {
          state: rotationX.toFixed()
        }
      })
  
      this.emitEntity({
        name: 'Neigung Y',
        key: 'tilt_y',
        unit: '°',
        states: {
          state: rotationY.toFixed()
        }
      })
  
      this.emitEntity({
        name: 'G-Kraft X',
        key: 'force_x',
        unit: 'g',
        states: {
          state: accelX.toFixed(2)
        }
      })
  
      this.emitEntity({
        name: 'G-Kraft Y',
        key: 'force_y',
        unit: 'g',
        states: {
          state: accelY.toFixed(2)
        }
      })
  
      this.emitEntity({
        name: 'G-Kraft Z',
        key: 'force_z',
        unit: 'g',
        states: {
          state: accelZ.toFixed(2)
        }
      })
  
      this.emitEntity({
        name: 'Rotation X',
        key: 'rotation_x',
        unit: '°s',
        states: {
          state: gyroX.toFixed(2)
        }
      })
  
      this.emitEntity({
        name: 'Rotation Y',
        key: 'rotation_y',
        unit: '°s',
        states: {
          state: gyroY.toFixed(2)
        }
      })
  
      this.emitEntity({
        name: 'Rotation Z',
        key: 'rotation_z',
        unit: '°s',
        states: {
          state: gyroZ.toFixed(2)
        }
      })
    } catch (error) {
      console.log('SHIT', error.message)

      //this.restart()

      throw error
    }
  }
}