import fs from 'fs'

export default async ({ device, log, modulePath, mqttConfig, updateConfig }) => {
  const dev = device('Vantelligence', 'Connector', '1')
  const getOptions = () => new Promise(resolve => {
    fs.readdir(modulePath, async (error, files) => {
      if (error) {
        return logError(error)
      }
      
      const options = {
        '': ''
      }

      files.forEach(f => {
        const key = String(f).slice(0, f.lastIndexOf('.'))
    
        options[key] = key
      })

      resolve(options)
    })
  })

  const select = dev.select('type_new', 'Type', {
    category: 'config',
    options: await getOptions()
  })
  
  select.command(value => {
    log(value)
  })

  const button = dev.button('create_new', 'Create', {
    category: 'config'
  })
  
  button.availability(false)
  button.state(true)
  button.command(value => {
    log(value)
  })



  const text = dev.text('text_new', 'Text', {
    category: 'config'
  })
  
  text.state('EinName')
  text.command(value => {
    log(value)
  })

  updateConfig([
    {
      id: 'test'
    }
  ])

  log('###############', mqttConfig)
}