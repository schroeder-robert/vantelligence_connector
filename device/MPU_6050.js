import i2c from 'i2c-bus'
import MPU6050 from 'i2c-mpu6050'
import Device from './base.js'
import KalmanFilter from 'kalmanjs'

const filterRotationX = new KalmanFilter({ R: 0.01, Q: 1 })
const filterRotationY = new KalmanFilter({ R: 0.01, Q: 1 })
const filterAccelX = new KalmanFilter({ R: 0.01, Q: 3 })
const filterAccelY = new KalmanFilter({ R: 0.01, Q: 3 })
const filterAccelZ = new KalmanFilter({ R: 0.01, Q: 3 })
const filterGyroX = new KalmanFilter({ R: 0.01, Q: 3 })
const filterGyroY = new KalmanFilter({ R: 0.01, Q: 3 })
const filterGyroZ = new KalmanFilter({ R: 0.01, Q: 3 })
const filterTemp = new KalmanFilter({ R: 0.01, Q: 3 })

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

        rotationX = filterRotationX.filter(data.rotation.x)
        rotationY = filterRotationY.filter(data.rotation.y)
        accelX = filterAccelX.filter(data.accel.x)
        accelY = filterAccelY.filter(data.accel.y)
        accelZ = filterAccelZ.filter(data.accel.z)
        gyroX = filterGyroX.filter(data.gyro.x)
        gyroY = filterGyroY.filter(data.gyro.y)
        gyroZ = filterGyroZ.filter(data.gyro.z)
        temp = filterTemp.filter(data.temp)

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