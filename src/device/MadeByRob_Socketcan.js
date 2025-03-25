import can from 'socketcan'
import base from './base.js'

const STORE = {}
const values = {}

export const info = {
  manufacturer: 'MadeByRob',
  model: 'CAN-Bus Ford',
  version: '1'
}

export const device = class extends base {
  constructor (config) {
    super(info, config)

    this.manufacturer = '...'
    this.model = 'CAN'
    this.version = '1'
  }

  async connect () {
    const { connection } = this.config
    const channel = can.createRawChannel(connection.bus, true)
    const network = can.parseNetworkDescription('can/ford_cgea1_2_ptcan_2011.kcd')
    const bus = new can.DatabaseService(channel, network.buses['ford_cgea1_2_ptcan_2011'])
    const messages = ['GPS_Data_Nav_1_HS', 'GPS_Data_Nav_2_HS', 'GPS_Data_Nav_3_HS', 'Media_Front_Panel', 'Doors_Front']

    messages.forEach(m => {
      const message = bus.messages[m]
      
      Object.values(message.signals).forEach(s => s.onChange(s => {
        // console.log(m, s.name,  s.value)
        
        if (!(m in values)) {
          values[m] = {}
        }
        
        values[m][s.name] = s.value

        if (m  === 'Media_Front_Panel') {
          // console.log(m, s.name, s.value)
        }

        if (m  === 'Doors_Front') {
          // console.log(m, s.name, s.value)
        }
      }))
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
      'GPS_Compass_direction'
    ]

    this.poll(1000, () => {
      const gps1 = values['GPS_Data_Nav_1_HS'] || {}
      const latitude = ((gps1['GPS_Latitude_Degrees'] || 0) + (((gps1['GPS_Latitude_Minutes'] || 0) + (gps1['GPS_Latitude_Min_dec'] || 0)) / 60)) * ((gps1['GpsHsphLattSth_D_Actl'] || 1) === 1 ? -1 : 1 )
      const longitude = ((gps1['GPS_Longitude_Degrees'] || 0) + (((gps1['GPS_Longitude_Minutes'] || 0) + (gps1['GPS_Longitude_Min_dec'] || 0)) / 60)) * ((gps1['GpsHsphLongEast_D_Actl'] || 1) === 1 ? 1 : -1 )
      
      const gps2 = values['GPS_Data_Nav_2_HS'] || {}
      const time = String(2000 + (gps2['GpsUtcYr_No_Actl'] || 0)).padStart(4, '0') + '-' + String(gps2['GpsUtcMnth_No_Actl'] || 0).padStart(2, '0') + '-' + String(gps2['GpsUtcDay_No_Actl'] || 0).padStart(2, '0') + 'T' + String(gps2['GPS_UTC_hours'] || 0).padStart(2, '0') + ':' + String(gps2['GPS_UTC_minutes'] || 0).padStart(2, '0') + ':' + String(gps2['GPS_UTC_seconds'] || 0).padStart(2, '0')
      const direction = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][gps2['GPS_Compass_direction'] || 0]
      const positionalDop = (gps2['GPS_Pdop'] || 0)
      
      const gps3 = values['GPS_Data_Nav_3_HS'] || {}
      const altitude = (gps3['GPS_MSL_altitude'] || 0)
      const speed = (gps3['GPS_Speed'] || 0)
      const satellites = (gps3['GPS_Sat_num_in_view'])
      const heading = (gps3['GPS_Heading'] || 0)
      const verticalDop = (gps3['GPS_Vdop'] || 0)
      const horizontalDop = (gps3['GPS_Hdop'] || 0)

      this.emitEntity({
        name: 'GPS Vertical DOP',
        key: 'gps_vertical_dop',
        unit: '',
        states: {
          state: verticalDop
        }
      })

      this.emitEntity({
        name: 'GPS Horizontal DOP',
        key: 'gps_horizontal_dop',
        unit: '',
        states: {
          state: horizontalDop
        }
      })

      this.emitEntity({
        name: 'GPS Positional DOP',
        key: 'gps_positional_dop',
        unit: '',
        states: {
          state: positionalDop
        }
      })

      this.emitEntity({
        name: 'GPS Heading',
        key: 'gps_heading',
        unit: '°',
        states: {
          state: Math.round(heading)
        }
      })

      this.emitEntity({
        name: 'GPS Direction',
        key: 'gps_direction',
        states: {
          state: direction
        }
      })

      this.emitEntity({
        name: 'GPS Satellites',
        key: 'gps_satellites',
        unit: '',
        states: {
          state: satellites && satellites <= 10 ? satellites : 0
        }
      })

      this.emitEntity({
        name: 'GPS Speed',
        key: 'gps_speed',
        class: 'speed',
        unit: 'km/h',
        states: {
          state: speed ? Number(speed * 1.609344).toFixed(1) : 0
        }
      })

      this.emitEntity({
        name: 'GPS Altitude',
        key: 'gps_altitude',
        class: 'distance',
        unit: 'm',
        states: {
          state: altitude ? Number(altitude / 3.28084).toFixed(1) : 0
        }
      })

      this.emitEntity({
        name: 'GPS Time',
        key: 'gps_time',
        class: 'date',
        states: {
          state: time
        }
      })

      this.emitEntity({
        type: 'tracker',
        name: 'GPS',
        key: 'gps',
        icon: 'mdi:map-marker',
        states: {
          // state: 'home',
          json_attributes: JSON.stringify({
            latitude,
            longitude,
            gps_accuracy: positionalDop
          })
        }
      })

      // Temp automatic
      for(m in values) {
        // if (m === 'GPS_Data_Nav_1_HS') continue

        for(s in values[m]) {
          if (ignored.includes(s)) continue

          this.emitEntity({
            name: m + ' ' + s,
            key: m + '_' + s,
            states: {
              state: values[m][s]
            }
          })
        }
      }
    })
  }
}