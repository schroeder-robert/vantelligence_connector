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
    this.flipX = this.config.axles?.x?.flip ? -1 : 1
    this.flipY = this.config.axles?.y?.flip ? -1 : 1
    this.flipZ = this.config.axles?.z?.flip ? -1 : 1
    this.mapX = this.config.axles?.x?.map || 'x'
    this.mapY = this.config.axles?.y?.map || 'y'
    this.mapZ = this.config.axles?.z?.map || 'z'
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
    const samples = 1

    let accelRaw = {}
    let accelNormalized = {}
    let accelX = 0
    let accelY = 0
    let accelZ = 0
    let gyroRaw = {}
    let gyroX = 0
    let gyroY = 0
    let gyroZ = 0
    let rotationRaw = {}
    let rotationX = 0
    let rotationY = 0
    let temp = 0

    try {        
      for (let i = 0; i < samples; ++i) {
        accelRaw = this.sensor.readAccelSync()
        accelNormalized = {
          x: accelRaw[this.mapX] * this.flipX,
          y: accelRaw[this.mapY] * this.flipY,
          z: accelRaw[this.mapZ] * this.flipZ
        }
        accelX = this.filters.accelX.filter(accelRaw[this.mapX] * this.flipX)
        accelY = this.filters.accelY.filter(accelRaw[this.mapY] * this.flipY)
        accelZ = this.filters.accelZ.filter(accelRaw[this.mapZ] * this.flipZ)

        gyroRaw = this.sensor.readGyroSync()
        gyroX = this.filters.gyroX.filter(gyroRaw[this.mapX] * this.flipX)
        gyroY = this.filters.gyroY.filter(gyroRaw[this.mapY] * this.flipY)
        gyroZ = this.filters.gyroZ.filter(gyroRaw[this.mapZ] * this.flipZ)

        rotationRaw = this.sensor.readRotationSync(accelNormalized)
        rotationX = this.filters.rotationX.filter(rotationRaw.x)
        rotationY = this.filters.rotationY.filter(rotationRaw.y)
        
        temp = this.filters.temp.filter(this.sensor.readTempSync())

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