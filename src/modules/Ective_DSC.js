import { DelimiterParser } from '@serialport/parser-delimiter'

const REGISTERS = {
  other: 0xe1,
  status: 0xe2
}

const ERROR_PROCESS_STATUS_MESSAGE = 'Cannot process info message: '
const ERROR_REGISTER_UNKNOWN = 'Unknown response register: '

export default ({ device, poll, prop, createSerialConnection, log, logError }) => {
  const dev = device('Ective', 'DSC', '1')
  const voltageBoardBattery = dev.sensor('voltage_board_battery', 'Spannung Bordbatterie', { class: 'voltage', unit: 'V' })
  const panelVoltage = dev.sensor('panel_voltage', 'Spannung Eingang', { class: 'voltage', unit: 'V' })
  const panelPower = dev.sensor('panel_power', 'Leistung Eingang', { class: 'power', unit: 'W' })
  const chargingPower = dev.sensor('charging_power', 'Leistung Ausgang', { class: 'power', unit: 'W' })
  const chargingCurrent = dev.sensor('charging_current', 'Ladestrom', { class: 'current', unit: 'A' })
  const chargingEnergy = dev.sensor('charging_energy', 'Geladene Energie', { class: 'energy', unit: 'kWh' })
  const connection = prop('connection', { port: '/dev/serial/by-id/' + prop('id') })

  const sendSerial = createSerialConnection({ path: connection.port, baudRate: 9600 }, new DelimiterParser({ delimiter: Buffer.from([0xFF]) }))

  poll(3000, async () => {
    let buffer = await sendSerial(Buffer.from([255, 226, 2, 228]))

    if (buffer.length < 1) throw new Error('Buffer too short')

    const index = Object.values(REGISTERS).indexOf(buffer.readUInt8(0))

    if (index < 0) {
      this.error(ERROR_REGISTER_UNKNOWN + buffer.readUInt8(0).toString(16))
    }

    const register = Object.keys(REGISTERS)[index]
    
    buffer = buffer.slice(1)

    if (register === 'status') {
      let data = {}

      try {
        if (buffer.length < 38) throw new Error()

        data.chargingCurrent = buffer.readUInt16BE(0) / 10
        data.boardBatteryVoltage = buffer.readUInt16BE(2) / 100
        data.unknown0 = buffer.readUInt16BE(4)
        data.unknown1 = buffer.readUInt16BE(6)
        data.panelPower = buffer.readUInt16BE(8)
        data.panelVoltage = buffer.readUInt16BE(10) / 10
        data.unknown2 = buffer.readUInt16BE(12)
        data.unknown3 = buffer.readUInt16BE(14)
        data.unknown4 = buffer.readUInt16BE(16)
        data.unknown5 = buffer.readUInt16BE(18)
        data.unknown6 = buffer.readUInt16BE(20)
        data.unknown7 = buffer.readUInt16BE(22)
        data.chargedEnergy = buffer.readUInt16BE(24) / 1000
        data.unknown8 = buffer.readUInt16BE(26)
        data.unknown9 = buffer.readUInt16BE(28)
        data.unknown10 = buffer.readUInt16BE(30)
        data.unknown11 = buffer.readUInt16BE(32)
        data.unknown12 = buffer.readUInt16BE(34)
        data.unknown13 = buffer.readUInt16BE(36)
        data.chargingPower = Math.round(data.boardBatteryVoltage * data.chargingCurrent)
      } catch (e) {
        logError(ERROR_PROCESS_STATUS_MESSAGE + e)
      }

      voltageBoardBattery.state(data.boardBatteryVoltage)
      panelVoltage.state(data.panelVoltage)
      panelPower.state(data.panelPower)
      chargingPower.state(data.chargingPower)
      chargingCurrent.state(data.chargingCurrent)
      chargingEnergy.state(data.chargedEnergy)
    }
  })
}