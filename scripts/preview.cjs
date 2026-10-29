const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'src');
http.createServer((req, res) => {
  const name = req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0].slice(1);
  const file = path.resolve(root, name);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', ({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript'})[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
}).listen(5173, '127.0.0.1', () => console.log('Calendar preview listening on port 5173'));
