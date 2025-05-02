import can from 'socketcan'

const STORE = {}
const values = {}
const FP_BUTTONS = {
  24: 'Sound',
  31: 'Power',
  50: 'SeekPrevious',
  51: 'SeekNext',
  68: 'Mute',
  74: 'TunePlus',
  75: 'TuneMinus',
  79: 'Source',
  80: 'Display',
}
const SW_BUTTONS = {
  48: 'Command',
  97: 'Previous',
  98: 'Next',
  253: 'VolumeUp',
  254: 'VolumeDown'
}

export default ({ device, poll, prop, entityUnits, log }) => {
  // basics
  const dev = device('Ford', 'HS-CAN', '1')
  const connection = prop('connection', { interface: 'can0' })

  // entities
  const gpsVerticalDop = dev.sensor('gps_vertical_dop', 'GPS Vertical DOP')
  const gpsHorizontalDop = dev.sensor('gps_horizontal_dop', 'GPS Horizontal DOP')
  const gpsPositionalDop = dev.sensor('gps_positional_dop', 'GPS Positional DOP')
  const gpsHeading = dev.sensor('gps_heading', 'GPS Heading', { unit: '°' })
  const gpsDirection = dev.sensor('gps_direction', 'GPS Direction')
  const gpsSatellites = dev.sensor('gps_satellites', 'GPS Satellites')
  const gpsSpeed = dev.sensor('gps_speed', 'GPS Speed', { class: 'speed', unit: 'mp/h' })
  const gpsAltitude = dev.sensor('gps_altitude', 'GPS Altitude', { class: 'distance', unit: 'ft' })
  const gpsTime = dev.sensor('gps_time', 'GPS Time', { class: 'date' })
  const gpsTracker = dev.tracker('gps', 'GPS', { icon: 'mdi:map-marker' })
  const engineRpm = dev.sensor('engine_rpm', 'Engine RPM', { icon: 'mdi:engine', unit: entityUnits.rpm })
  const frontPanelVolumeDown = dev.binarySensor('front_panel_volume_down', 'Front Panel Volume Down')
  const frontPanelVolumeUp = dev.binarySensor('front_panel_volume_up', 'Front Panel Volume Up')
  const frontPanelButtons = {}
  const steeringWheelButtons = {}
  
  Object.entries(FP_BUTTONS).forEach(([i, b]) => frontPanelButtons[i] = dev.binarySensor('front_panel_' + b.toLowerCase(), 'Front Panel ' + b))
  Object.entries(SW_BUTTONS).forEach(([i, b]) => steeringWheelButtons[i] = dev.binarySensor('steering_wheel_' + b.toLowerCase(), 'Steering Wheel ' + b))

  // communication
  const channel = can.createRawChannel(connection.interface, true)
  const network = can.parseNetworkDescription('can/ford_cgea1_2_ptcan_2011.kcd')
  const bus = new can.DatabaseService(channel, network.buses['ford_cgea1_2_ptcan_2011'])
  const messages = [
    'GPS_Data_Nav_1_HS',
    'GPS_Data_Nav_2_HS',
    'GPS_Data_Nav_3_HS',
    'Media_Front_Panel',
    'Media_Steering_Wheel',
    'Doors_Front',
    'Engine'
  ]

  messages.forEach(key => {
    const message = bus.messages[key]
    let id = 0
    
    Object.values(message.signals).forEach(s => {
      // log(s)
      s.onChange(signal => {
        if (key  === 'Media_Steering_Wheel') {
          if (signal.value === 255) {
            Object.values(steeringWheelButtons).forEach(b => b.state('OFF'))
          } else {
            steeringWheelButtons[signal.value]?.state('ON')
          }
        } else if (key  === 'Media_Front_Panel') {
          if (signal.name === 'Button') {
            id = signal.value
          } else if (id < 255 && signal.name === 'Action') {
            frontPanelButtons[id].state(signal.value == 16 ? 'ON' : 'OFF')
          } else if (signal.name === 'Direction') {
            frontPanelVolumeDown.state(signal.value == 29 ? 'ON' : 'OFF')
            frontPanelVolumeUp.state(signal.value == 31 ? 'ON' : 'OFF')
          }

          // console.log(key, signal.name, signal.value)
        } else if (key  === 'Doors_Front') {
          console.log(key, signal.name, signal.value)
        } else {
          values[key] = values[key] || {}
          values[key][signal.name] = signal.value
        }
      })
    })
  })

  channel.start()

  // console.log(connection.bus, 'ready')

  const ignored = [
    'GPS_Latitude_Degrees',
    'GPS_Latitude_Minutes',
    'GPS_Latitude_Min_dec',
    'GpsHsphLattSth_D_Actl',
    'GPS_Longitude_Degrees',
    'GPS_Longitude_Minutes',
    'GPS_Longitude_Min_dec',
    'GpsHsphLongEast_D_Actl',
    'GpsUtcYr_No_Actl',
    'GpsUtcMnth_No_Actl',
    'GpsUtcDay_No_Actl',
    'GPS_UTC_hours',
    'GPS_UTC_minutes',
    'GPS_UTC_seconds',
    'GPS_MSL_altitude',
    'GPS_Speed',
    'GPS_Heading',
    'GPS_Vdop',
    'GPS_Hdop',
    'GPS_Pdop',
    'GPS_Sat_num_in_view',
    'GPS_Compass_direction',
    'Engine_RPM'
  ]

  poll(1000, async () => {
    const gps1 = values['GPS_Data_Nav_1_HS'] || {}
    const gps2 = values['GPS_Data_Nav_2_HS'] || {}
    const gps3 = values['GPS_Data_Nav_3_HS'] || {}
    const engine = values['Engine'] || {}

    gpsVerticalDop.state(gps3['GPS_Vdop'] || 0)
    gpsHorizontalDop.state(gps3['GPS_Hdop'] || 0)
    gpsPositionalDop.state(gps2['GPS_Pdop'] || 0)
    gpsHeading.state((v => v ? Math.round(v) : 0)(gps3['GPS_Heading']))
    gpsDirection.state(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][gps2['GPS_Compass_direction'] || 0])
    gpsSatellites.state(gps3['GPS_Sat_num_in_view'] || 0)
    gpsSpeed.state(gps3['GPS_Speed'] || 0) // Number(speed * 1.609344).toFixed(1)
    gpsAltitude.state(gps3['GPS_MSL_altitude'] || 0) // Number(altitude / 3.28084).toFixed(1)
    gpsTime.state(String(2000 + (gps2['GpsUtcYr_No_Actl'] || 0)).padStart(4, '0') + '-' + String(gps2['GpsUtcMnth_No_Actl'] || 0).padStart(2, '0') + '-' + String(gps2['GpsUtcDay_No_Actl'] || 0).padStart(2, '0') + 'T' + String(gps2['GPS_UTC_hours'] || 0).padStart(2, '0') + ':' + String(gps2['GPS_UTC_minutes'] || 0).padStart(2, '0') + ':' + String(gps2['GPS_UTC_seconds'] || 0).padStart(2, '0'))
    gpsTracker.stateById('json_attributes', {
      latitude: ((gps1['GPS_Latitude_Degrees'] || 0) + (((gps1['GPS_Latitude_Minutes'] || 0) + (gps1['GPS_Latitude_Min_dec'] || 0)) / 60)) * ((gps1['GpsHsphLattSth_D_Actl'] || 1) === 1 ? -1 : 1 ),
      longitude: ((gps1['GPS_Longitude_Degrees'] || 0) + (((gps1['GPS_Longitude_Minutes'] || 0) + (gps1['GPS_Longitude_Min_dec'] || 0)) / 60)) * ((gps1['GpsHsphLongEast_D_Actl'] || 1) === 1 ? 1 : -1 ),
      gps_accuracy: gpsPositionalDop.state()
    })
    engineRpm.state(engine['Engine_RPM'] ? Math.round(engine['Engine_RPM'] / 4) : 0)

    // Temp automatic
    for (let key in values) {
      for (let signal in values[key]) {
        if (ignored.includes(signal)) continue

        const entity = dev.sensor(key + '_' + signal)
        
        entity.state(values[key][signal])
      }
    }
  })
}