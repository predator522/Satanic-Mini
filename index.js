const express = require('express');
  const app = express();
  const path = require('path');
  const PORT = process.env.PORT || 8000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/code', require('./pair'));
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'main.html')));

  app.listen(PORT, () => console.log('✅ SATANIC MINI running on port ' + PORT));
  