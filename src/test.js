import http from 'http'

const host = 'localhost'
const port = 8008

const server = http.createServer();
server.listen(port, host, () => {
  console.log(`Server is running on http://${host}:${port}`)
})