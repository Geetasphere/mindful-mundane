// Simple local dev server that mirrors vercel.json rewrites
// Run: node serve-local.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const BASE = __dirname;

const ROUTES = {
  '/':        'index.html',
  '/kitchen': 'Mindful Kitchen Website/mindfulkitchen.html',
  '/make':    'Mindful Kitchen Website/make.html',
  '/spending':'Mindful Spending Website/mindfulspending.html',
  '/spaces':  'Mindful Spaces Website/mindfulspaces.html',
  '/design':  'Mindful Spaces Website/design.html',
  '/admin':   'Mindful Spending Website/admin.html',
};

const MIME = {
  '.html':'.html', '.css':'text/css', '.js':'application/javascript',
  '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg',
  '.ico':'image/x-icon', '.woff2':'font/woff2', '.woff':'font/woff',
};
MIME['.html'] = 'text/html';

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0].split('#')[0]) || '/';
  const clean = urlPath.replace(/\/$/, '') || '/';

  // Match route (with or without hash anchor)
  const routeKey = Object.keys(ROUTES).find(r => clean === r || clean.startsWith(r + '#'));
  const filePath = path.join(BASE, routeKey ? ROUTES[routeKey] : urlPath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + filePath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`\n  Local dev server running at http://localhost:${PORT}\n`);
  console.log('  Routes:');
  Object.keys(ROUTES).forEach(r => console.log(`    http://localhost:${PORT}${r}`));
  console.log('');
});
