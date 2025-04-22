import i2c from 'i2c-bus'
import MPU6050 from 'i2c-mpu6050'
import KalmanFilter from 'kalmanjs'

export default ({ device, poll, prop, wait, restart, logError }) => {
  const dev = device('TDK InvenSense', 'MPU-6050', '1')
  const connection = prop('connection', { bus: 1, address: 0x68 })
  const axles = prop('axles', {})
  const interval = prop('interval', 500)
  const bus = i2c.openSync(connection.bus)
  const flipX = axles?.x?.flip ? -1 : 1
  const flipY = axles?.y?.flip ? -1 : 1
  const flipZ = axles?.z?.flip ? -1 : 1
  const mapX = axles?.x?.map || 'x'
  const mapY = axles?.y?.map || 'y'
  const mapZ = axles?.z?.map || 'z'
  const filters = {
    te: new KalmanFilter({ R: 0.01, Q: 3 }),
    ax: new KalmanFilter({ R: 0.01, Q: 3 }),
    ay: new KalmanFilter({ R: 0.01, Q: 3 }),
    az: new KalmanFilter({ R: 0.01, Q: 3 }),
    gx: new KalmanFilter({ R: 0.01, Q: 3 }),
    gy: new KalmanFilter({ R: 0.01, Q: 3 }),
    gz: new KalmanFilter({ R: 0.01, Q: 3 })
  }

  const temperature = dev.sensor('temperature', 'Temperatur')
  const tiltX = dev.sensor('tilt_x', 'Neigung X', { unit: '°' })
  const tiltY = dev.sensor('tilt_y', 'Neigung Y', { unit: '°' })
  const forceX = dev.sensor('force_x', 'G-Kraft X', { unit: 'g' })
  const forceY = dev.sensor('force_y', 'G-Kraft Y', { unit: 'g' })
  const forceZ = dev.sensor('force_z', 'G-Kraft Z', { unit: 'g' })
  const rotationX = dev.sensor('rotation_x', 'Rotation X', { unit: '°s' })
  const rotationY = dev.sensor('rotation_y', 'Rotation Y', { unit: '°s' })
  const rotationZ = dev.sensor('rotation_z', 'Rotation Z', { unit: '°s' })

  try {
    const sensor = new MPU6050(bus, connection.address)

    poll(interval, async () => {
      const samples = 1
      const data = {}
        
      for (let i = 0; i < samples; ++i) {
        data.te = filters.temp.filter(sensor.readTempSync())
        
        const accel = sensor.readAccelSync()

        data.ax = filters.ax.filter(accel[mapX] * flipX)
        data.ay = filters.ay.filter(accel[mapY] * flipY)
        data.az = filters.az.filter(accel[mapZ] * flipZ)
  
        const gyro = sensor.readGyroSync()

        data.gx = filters.gx.filter(gyro[mapX] * flipX)
        data.gy = filters.gy.filter(gyro[mapY] * flipY)
        data.gz = filters.gz.filter(gyro[mapZ] * flipZ)
  
        const rotation = sensor.readRotationSync({ x: data.ax, y: data.ay, z: data.az })
        
        data.rx = rotation.x
        data.ry = rotation.y

        await wait(interval / samples)
      }
  
      tiltX.state(data.rx.toFixed())
      tiltY.state(data.ry.toFixed())
      forceX.state(data.ax.toFixed(2))
      forceY.state(data.ay.toFixed(2))
      forceZ.state(data.az.toFixed(2))
      rotationX.state(data.gx.toFixed(2))
      rotationY.state(data.gy.toFixed(2))
      rotationZ.state(data.gz.toFixed(2))
      temperature.state(data.te.toFixed(1))
    })
  } catch (error) {
    logError(error.message)

    return restart()
  }
}