const next = require("next")
const http = require("http")

const port = process.env.PORT || 6767
const dev = false

const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  http.createServer((req, res) => {
    handle(req, res)
  }).listen(port, () => {
    console.log(`Next.js app running on http://localhost:${port}`);
  })
})