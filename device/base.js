import chalk from 'chalk'

export default class {
  constructor (config) {
    this.manufacturer = 'DEFAULT'
    this.model = 'DEFAULT'
    this.config = config
    this.options = {}
    this.onMessageCallback = null
    this.onEntityUpdateCallback = null
  }

  get name () {
    return this.config.name
  }

  get id () {
    return this.config.id
  }

  onMessage (callback) {
    this.onMessageCallback = callback
  }

  onEntityUpdate (callback) {
    this.onEntityUpdateCallback = callback
  }

  log (message, icon) {
    if (typeof this.onMessageCallback === 'function') {
      this.onMessageCallback(icon ? icon : 'ℹ️', message)
    }
  }

  emitEntity (entity) {
    if (typeof this.onEntityUpdateCallback === 'function') {
      this.onEntityUpdateCallback(entity)
    }
  }

  async poll (method, time, callback) {
    callback = typeof callback === 'function' ? callback : () => {}
    
    if (typeof this[method] === 'function') {
      setInterval(async () => callback(await this[method]()), time)
      
      callback(await this[method]())
    }
  }

  async handle (entity, state, value) {
    const method = 'set' + this.convertKeyToMethod(entity)

    if (typeof this[method] === 'function') {
      return await this[method](value, state)
    } else {
      this.log('Method "' + chalk.red(method) + '" not found!', '⚠️')
    }
  }

  disconnect () {}

  convertKeyToMethod (value) {
    return String(value).replace(/((^|[_])[a-z])/ig, match => match.toUpperCase().replace('_', ''))
  }

  convertNameToKey (value) {
    return String(value).toLowerCase().replace(/[ ]/g, '_')
  }
}