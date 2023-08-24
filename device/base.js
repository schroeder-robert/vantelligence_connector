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

  error (message) {
    this.log(message, '🛑')
  }

  warning (message) {
    this.log(message, '⚠️')
  }

  info (message) {
    this.log(message, 'ℹ️')
  }

  emitEntity (entity) {
    if (typeof this.onEntityUpdateCallback === 'function') {
      this.onEntityUpdateCallback(entity)
    }
  }

  async poll (time, method, callback) {
    let args = []

    callback = typeof callback === 'function' ? callback : () => {}

    if (method instanceof Array) {
      args = method.slice(1)
      method = method[0]
    }

    if (typeof method === 'string' && typeof this[method] === 'function') {
      method = this[method]
    }

    if (typeof method === 'function') {
      const call = async () => {
        try {
          const result = await method(...args)

          callback(result)
        } catch (error) {
          this.error(error)

          // experimental!
          //clearInterval(interval)
        }
      }

      const interval = setInterval(call, time)
      
      call()
    }
  }

  async wait (time) {
    return new Promise(resolve => setTimeout(resolve, time))
  }

  async handle (entity, state, value) {
    const method = 'set' + this.convertKeyToMethod(entity)

    if (typeof this[method] === 'function') {
      try {
        return await this[method](value, state)
      } catch (error) {
        this.error(error)
      }
    } else {
      this.warning('Method "' + chalk.red(method) + '" not found!')
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