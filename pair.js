const express = require('express');
const router = express.Router();
const path = require('path');
const os = require('os');
const fse = require('fs-extra');
const pino = require('pino');

let makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, Browsers;

// Load Baileys
async function loadBaileys() {
  if (makeWASocket) return;
  const b = await import('@whiskeysockets/baileys');
  makeWASocket = b.default;
  useMultiFileAuthState = b.useMultiFileAuthState;
  makeCacheableSignalKeyStore = b.makeCacheableSignalKeyStore;
  Browsers = b.Browsers;
}

// TEST ROUTE (to confirm /code works)
router.get('/test', (req, res) => {
  res.send("✅ /code route is working");
});

// MAIN PAIR ROUTE
router.get('/', async (req, res) => {
  const number = String(req.query.number || '').replace(/[^0-9]/g, '');

  if (!number || number.length < 7) {
    return res.status(400).json({ error: 'Invalid number' });
  }

  try {
    await loadBaileys();

    const sessionPath = path.join(os.tmpdir(), 'wa_' + number);
    await fse.ensureDir(sessionPath);

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const logger = pino({ level: 'silent' });

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
      },
      printQRInTerminal: false,
      logger,
      browser: Browsers.macOS('Safari'),
    });

    sock.ev.on('creds.update', saveCreds);

    // ✅ WAIT FOR CONNECTION THEN REQUEST CODE
    let responded = false;

    sock.ev.on('connection.update', async (update) => {
      try {
        const { connection } = update;

        if (!responded && (connection === 'connecting' || connection === undefined)) {
          const code = await sock.requestPairingCode(number);

          responded = true;
          return res.json({ code });
        }
      } catch (err) {
        console.error("PAIR ERROR:", err);

        if (!responded) {
          responded = true;
          return res.status(500).json({ error: 'Pairing failed' });
        }
      }
    });

    // ⛑️ Timeout protection (Railway safe)
    setTimeout(() => {
      if (!responded) {
        responded = true;
        return res.status(500).json({ error: 'Timeout generating code' });
      }
    }, 15000);

  } catch (err) {
    console.error("MAIN ERROR:", err);
    return res.status(500).json({ error: 'Service error' });
  }
});

module.exports = router;
