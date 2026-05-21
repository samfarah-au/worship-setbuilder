const { default: app } = require('../apps/api/dist/app')

module.exports = function handler(req, res) {
  req.url = (req.url || '/').replace(/^\/api/, '') || '/'
  app(req, res)
}
