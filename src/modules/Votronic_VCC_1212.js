const ERROR_PROCESS_MESSAGE = 'Cannot process info message: '

export default async ({ device, prop, createSerialConnection, logError }) => {
  // basics
  const dev = device('Votronic', 'VCC 1212-30', '1')
  const connection = prop('connection', { port: '/dev/serial/by-id/' + prop('id') })

  // entities
  const voltageStartBattery = dev.sensor('voltage_start_battery', 'Spannung Starterbatterie', { class: 'voltage', unit: 'V' })
  const voltageBoardBattery = dev.sensor('voltage_board_battery', 'Spannung Bordbatterie', { class: 'voltage', unit: 'V' })
  const currentBoardBattery = dev.sensor('current_board_battery', 'Ladestrom Bordbatterie', { class: 'current', unit: 'A' })
  
  createSerialConnection({ path: connection.port, baudRate: 1000 }, null, buffer => {
    if (buffer.length < 8) return

    let data = {}

    try {
      if (buffer.length < 8) throw new Error('Buffer too short')

      data.voltageBoard = buffer.readInt16LE(2) / 100
      data.voltageStart = buffer.readInt16LE(4) / 100
      data.currentBoard = buffer.readInt16LE(6) / 10
    } catch (e) {
      logError(ERROR_PROCESS_MESSAGE + e)
    }
    
    if (data.voltageStart > 5 && data.voltageStart < 20) voltageStartBattery.state(data.voltageStart)
    if (data.voltageBoard > 5 && data.voltageBoard < 20) voltageBoardBattery.state(data.voltageBoard)
    if (data.currentBoard < 50) currentBoardBattery.state(data.currentBoard)
  })
}