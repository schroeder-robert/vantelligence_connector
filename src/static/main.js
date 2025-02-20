const subscriptions = {}

function connect () {
  const ws = new WebSocket('ws://' + window.location.host + window.location.pathname)

  ws.addEventListener('open', e => {
    ws.send(JSON.stringify({
      subscribe: Object.keys(subscriptions)
    }))
  })

  // ws.addEventListener('error', e => {
  //   console.error('error', e)
  // })

  ws.addEventListener('close', e => {
    setTimeout(() => connect(), 3000)
  })

  ws.addEventListener('message', e => {
    const data = JSON.parse(e.data)

    if (data.topic in subscriptions) {
      subscriptions[data.topic](data)
    }
  })
}

function subscribe (topic, callback) {
  subscriptions[topic] = callback
}

function init (main) {
  document.onreadystatechange = () => {
    if (document.readyState === 'complete') {
      main()
      connect()
    }
  }
}