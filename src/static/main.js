const callbacks = {}
let ws

function connect () {
  return new Promise(resolve => {
    ws = new WebSocket((window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + window.location.pathname)

    ws.addEventListener('open', resolve)

    // ws.addEventListener('error', e => {
    //   console.error('error', e)
    // })

    ws.addEventListener('close', e => {
      setTimeout(() => connect(), 3000)
    })

    ws.addEventListener('message', e => {
      const data = JSON.parse(e.data)

      if (data.response && data.response in callbacks) callbacks[data.response](data)
    })
  })
}

function on (data, callback) {
  if (!ws) return
  if (typeof data !== 'object') data = { request: data }

  ws.send(JSON.stringify(data))

  callbacks[data.request] = callback
}

function init (main) {
  document.onreadystatechange = async () => {
    if (document.readyState === 'complete') {
      await connect()
      main()
    }
  }
}