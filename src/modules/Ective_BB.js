import { DelimiterParser } from '@serialport/parser-delimiter'

const REGISTERS = {
  0xe1: 'other',
  0xe2: 'status'
}

const ERROR_BUFFER_TOO_SHORT = 'Buffer too short'

export default async ({ device, poll, prop, createSerialConnection, log, logError }) => {
  // basics
  const dev = device('Ective', 'BB', '1')
  const connection = prop('connection', { port: '/dev/serial/by-id/' + prop('id') })

  // entities
  const voltageStartBattery = dev.sensor('voltage_start_battery', 'Spannung Starterbatterie', { class: 'voltage', unit: 'V' })
  const voltageBoardBattery = dev.sensor('voltage_board_battery', 'Spannung Bordbatterie', { class: 'voltage', unit: 'V' })
  const chargingCurrent = dev.sensor('charging_current', 'Ladestrom', { class: 'current', unit: 'A' })
  const chargingPower = dev.sensor('charging_power', 'Ladeleistung', { class: 'power', unit: 'W' })

  const byte1 = dev.sensor('byte1', 'Byte1', { unit: 'RPM' })
  const byte19 = dev.sensor('byte19', 'Byte19', { unit: 'RPM' })
  const byte23 = dev.sensor('byte23', 'Byte23', { unit: 'RPM' })
  const byte25 = dev.sensor('byte25', 'Byte25', { unit: 'RPM' })
  const byte37 = dev.sensor('byte37', 'Byte37', { unit: 'RPM' })
  
  // communication
  const sendSerial = createSerialConnection({ path: connection.port, baudRate: 9600 }, new DelimiterParser({ delimiter: Buffer.from([0xFF]) }))

  poll(3000, async () => {
    const buffer = await sendSerial([255, 226, 2, 228])
    const values = []

    for (let i = 1; i < buffer.length; i += 2) {
      values.push([map[i], buffer.readUInt16BE(i)])
    }
    
    switch (REGISTERS[buffer.readUInt8(0)]) {
      case 'status':
        if (buffer.length < 38) return logError(ERROR_BUFFER_TOO_SHORT, 'Expected: 38', 'Got: ' + buffer.length)

        voltageStartBattery.state(buffer.readInt16BE(33) / 10)
        voltageBoardBattery.state(buffer.readInt16BE(3) / 100)
        chargingCurrent.state(buffer.readUInt16BE(9) / 10)
        chargingPower.state(Math.round(voltageStartBattery.state() * chargingCurrent.state()))

        byte1.state(buffer.readUInt16BE(1))
        byte19.state(buffer.readUInt16BE(19))
        byte23.state(buffer.readUInt16BE(23))
        byte25.state(buffer.readUInt16BE(25))
        byte37.state(buffer.readUInt16BE(37))

        // console.table([Object.fromEntries(Array.from({ length: 19 }).map((v, i) => (o => [ o, (([1, 3, 9, 11, 25].includes(o) ? 'x ' : 0) + buffer.readUInt16BE(o))])(i * 2 + 1)))])
    }
  })
}