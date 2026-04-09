const express = require('express');
const app = express();

const PORT = process.env.PORT || 8000;

app.get('/', (req, res) => {
  res.send("IT WORKS 🔥");
});

app.listen(PORT, () => {
  console.log("Server running...");
});
