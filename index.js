const express = require('express');
const app = express();
const path = require('path');

const PORT = process.env.PORT || 8000;

// ROUTES FIRST
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// THEN LISTEN
app.listen(PORT, () => {
  console.log('✅ Server running on port ' + PORT);
});
