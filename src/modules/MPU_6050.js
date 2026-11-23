import i2c from 'i2c-bus'
import MPU6050 from 'i2c-mpu6050'
import KalmanFilter from 'kalmanjs'

export default ({ device, poll, prop, wait, restart, log, logError }) => {
  const dev = device('TDK InvenSense', 'MPU-6050', '1')
  const connection = prop('connection', { bus: 1, address: 0x68 })
  const axles = prop('axles', {})
  const interval = prop('interval', 250)
  const bus = i2c.openSync(connection.bus)
  const flipX = axles?.x?.flip ? -1 : 1
  const flipY = axles?.y?.flip ? -1 : 1
  const flipZ = axles?.z?.flip ? -1 : 1
  const mapX = axles?.x?.map || 'x'
  const mapY = axles?.y?.map || 'y'
  const mapZ = axles?.z?.map || 'z'
  const matrix = calculateRotationMatrix(axles?.x?.offset || 0, axles?.y?.offset || 0, axles?.z?.offset || 0)
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

    bus.writeByteSync(connection.address, 0x1A, 3)

    poll(interval, async () => {
      const samples = 1
      const data = {}
        
      for (let i = 0; i < samples; ++i) {
        data.te = filters.te.filter(sensor.readTempSync())

        const raw = sensor.readSync()
        const accel = rotateVector(raw.accel, matrix)
        const gyro = rotateVector(raw.gyro, matrix)
        const rotation = calculateRotation(accel)

        data.ax = /*filters.ax.filter*/(accel[mapX] * flipX)
        data.ay = /*filters.ay.filter*/(accel[mapY] * flipY)
        data.az = /*filters.az.filter*/(accel[mapZ] * flipZ)

        data.gx = /*filters.gx.filter*/(gyro[mapX] * flipX)
        data.gy = /*filters.gy.filter*/(gyro[mapY] * flipY)
        data.gz = /*filters.gz.filter*/(gyro[mapZ] * flipZ)
        
        data.rx = rotation.x
        data.ry = rotation.y

        // log(gyro)

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

function calculateRotationMatrix(rollDeg, pitchDeg, yawDeg) {
  const r = (rollDeg * Math.PI) / 180
  const p = (pitchDeg * Math.PI) / 180
  const y = (yawDeg * Math.PI) / 180

  const cr = Math.cos(r), sr = Math.sin(r)
  const cp = Math.cos(p), sp = Math.sin(p)
  const cy = Math.cos(y), sy = Math.sin(y)

  // Kombinierte Rotationsmatrix (Reihenfolge: Yaw -> Pitch -> Roll)
  return {
    r11: cp * cy,
    r12: sr * sp * cy - cr * sy,
    r13: cr * sp * cy + sr * sy,
    
    r21: cp * sy,
    r22: sr * sp * sy + cr * cy,
    r23: cr * sp * sy - sr * cy,
    
    r31: -sp,
    r32: sr * cp,
    r33: cr * cp
  }
}

function rotateVector(v, m) {
  return {
    x: v.x * m.r11 + v.y * m.r12 + v.z * m.r13,
    y: v.x * m.r21 + v.y * m.r22 + v.z * m.r23,
    z: v.x * m.r31 + v.y * m.r32 + v.z * m.r33
  }
}

function calculateRotation(accel) {
  const rollRad = Math.atan2(accel.y, accel.z)
  const pitchRad = Math.atan2(-accel.x, Math.sqrt(accel.y * accel.y + accel.z * accel.z))

  return {
    x: (rollRad * 180) / Math.PI,
    y: (pitchRad * 180) / Math.PI
  }
}