const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the root directory
app.use(express.static(__dirname));

// Serve CSS files with proper caching
app.use('/css', express.static(path.join(__dirname, 'css'), {
  maxAge: '1y',
  etag: true
}));

// Serve assets with proper caching
app.use('/assets', express.static(path.join(__dirname, 'assets'), {
  maxAge: '1y',
  etag: true
}));

// Serve HTML files from the html directory
app.get('/*', (req, res) => {
  // If the request is for the root, serve homepage.html
  if (req.path === '/') {
    res.sendFile(path.join(__dirname, 'html', 'homepage.html'));
  } else {
    // Otherwise, try to serve the requested HTML file
    res.sendFile(path.join(__dirname, 'html', req.path));
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 