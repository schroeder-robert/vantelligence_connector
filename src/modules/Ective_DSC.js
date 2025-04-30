import { DelimiterParser } from '@serialport/parser-delimiter'

const REGISTERS = {
  0xe1: 'other',
  0xe2: 'status'
}

const ERROR_BUFFER_TOO_SHORT = 'Buffer too short'

export default async ({ device, poll, prop, createSerialConnection, log, logError }) => {
  // basics
  const dev = device('Ective', 'DSC', '1')
  const connection = prop('connection', { port: '/dev/serial/by-id/' + prop('id') })

  // entities
  const voltageBoardBattery = dev.sensor('voltage_board_battery', 'Spannung Bordbatterie', { class: 'voltage', unit: 'V' })
  const panelVoltage = dev.sensor('panel_voltage', 'Spannung Eingang', { class: 'voltage', unit: 'V' })
  const panelPower = dev.sensor('panel_power', 'Leistung Eingang', { class: 'power', unit: 'W' })
  const chargingPower = dev.sensor('charging_power', 'Leistung Ausgang', { class: 'power', unit: 'W' })
  const chargingCurrent = dev.sensor('charging_current', 'Ladestrom', { class: 'current', unit: 'A' })
  const chargingEnergy = dev.sensor('charging_energy', 'Geladene Energie', { class: 'energy', unit: 'kWh' })
  
  // communication
  const sendSerial = createSerialConnection({ path: connection.port, baudRate: 9600 }, new DelimiterParser({ delimiter: Buffer.from([0xFF]) }))

  poll(3000, async () => {
    const buffer = await sendSerial([255, 226, 2, 228])

    switch (REGISTERS[buffer.readUInt8(0)]) {
      case 'status':
        if (buffer.length < 39) return logError(ERROR_BUFFER_TOO_SHORT, 'Expected: 39', 'Got: ' + buffer.length)

        chargingCurrent.state(buffer.readUInt16BE(1) / 10)
        voltageBoardBattery.state(buffer.readUInt16BE(3) / 100)
        panelPower.state(buffer.readUInt16BE(9))
        panelVoltage.state(buffer.readUInt16BE(11) / 10)
        chargingEnergy.state(buffer.readUInt16BE(25) / 1000)
        chargingPower.state(Math.round(voltageBoardBattery.state() * chargingCurrent.state()))

        // console.table([Object.fromEntries(Array.from({ length: 19 }).map((v, i) => (o => [ o, (([1, 3, 9, 11, 25].includes(o) ? 'x ' : 0) + buffer.readUInt16BE(o))])(i * 2 + 1)))])
    }
  })
}