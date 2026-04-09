const express = require('express');
  const router = express.Router();
  const path = require('path');
  const os = require('os');
  const fse = require('fs-extra');
  const pino = require('pino');
  const {
    aliveCommand, menuCommand, goodnightCommand, flirtCommand,
    tagAllCommand, tagCommand, hideTagCommand, groupInfoCommand,
    setGroupDescription, setGroupName, setGroupPhoto,
    antibadwordCommand,
    handleAntilinkCommand, handleLinkDetection,
    handleAntitagCommand, handleTagDetection,
    handleAntideleteCommand, storeMessage, handleMessageRevocation,
    checkBadword,
  } = require('./commands');
  const config = require('./config');

  let makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, Browsers, delay;

  async function loadBaileys() {
    if (makeWASocket) return;
    const b = await import('@whiskeysockets/baileys');
    makeWASocket = b.default;
    useMultiFileAuthState = b.useMultiFileAuthState;
    makeCacheableSignalKeyStore = b.makeCacheableSignalKeyStore;
    Browsers = b.Browsers;
    delay = b.delay;
  }

  const activeSockets = new Map();
  const PREFIX = config.PREFIX;

  function getText(message) {
    return (
      message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      message.message?.imageMessage?.caption ||
      message.message?.videoMessage?.caption || ''
    ).trim();
  }

  async function setupMessageHandler(socket) {
    socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        try {
          if (!msg.message || msg.key.fromMe) continue;
          const chatId  = msg.key.remoteJid;
          const sender  = msg.key.participant || msg.key.remoteJid;
          const isGroup = chatId.endsWith('@g.us');
          const text    = getText(msg);

          await storeMessage(socket, msg).catch(() => {});

          if (isGroup) {
            await handleLinkDetection(socket, chatId, msg, text, sender).catch(() => {});
            await handleTagDetection(socket, chatId, msg, sender).catch(() => {});
            await checkBadword(socket, chatId, msg, text).catch(() => {});
          }

          if (!text.startsWith(PREFIX)) continue;
          const cmd  = text.slice(PREFIX.length).split(' ')[0].toLowerCase();
          const args = text.slice(PREFIX.length + cmd.length).trim();
          const reply = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

          switch (cmd) {
            case 'alive':       await aliveCommand(socket, chatId, msg); break;
            case 'menu':        await menuCommand(socket, chatId, msg); break;
            case 'goodnight':   await goodnightCommand(socket, chatId, msg); break;
            case 'flirt':       await flirtCommand(socket, chatId, msg); break;
            case 'tagall':      if (isGroup) await tagAllCommand(socket, chatId, sender, msg); break;
            case 'tag':         if (isGroup) await tagCommand(socket, chatId, sender, args, reply, msg); break;
            case 'hidetag':     if (isGroup) await hideTagCommand(socket, chatId, sender, args, reply, msg); break;
            case 'groupinfo':   if (isGroup) await groupInfoCommand(socket, chatId, msg); break;
            case 'setgdesc':    if (isGroup) await setGroupDescription(socket, chatId, sender, args, msg); break;
            case 'setgname':    if (isGroup) await setGroupName(socket, chatId, sender, args, msg); break;
            case 'setgpp':      if (isGroup) await setGroupPhoto(socket, chatId, sender, msg); break;
            case 'antibadword': if (isGroup) await antibadwordCommand(socket, chatId, msg, sender, text); break;
            case 'antilink':    if (isGroup) await handleAntilinkCommand(socket, chatId, msg, sender, text); break;
            case 'antitag':     if (isGroup) await handleAntitagCommand(socket, chatId, msg, sender, text); break;
            case 'antidelete':  await handleAntideleteCommand(socket, chatId, msg, sender, text); break;
          }
        } catch (err) { console.error('Handler error:', err); }
      }
    });

    socket.ev.on('messages.update', async (updates) => {
      for (const u of updates) {
        if (u.update?.message?.protocolMessage?.type === 0) {
          await handleMessageRevocation(socket, u).catch(() => {});
        }
      }
    });
  }

  router.get('/', async (req, res) => {
    const number = String(req.query.number || '').replace(/[^0-9]/g, '');
    if (!number || number.length < 7) return res.status(400).json({ error: 'Invalid number' });

    if (activeSockets.has(number)) {
      try { activeSockets.get(number).ws?.close(); } catch {}
      activeSockets.delete(number);
    }

    try {
      await loadBaileys();
      const sessionPath = path.join(os.tmpdir(), 'wa_' + number);
      await fse.ensureDir(sessionPath);
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
      const logger = pino({ level: 'fatal' });

      const socket = makeWASocket({
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
        printQRInTerminal: false,
        logger,
        browser: Browsers.macOS('Safari'),
      });

      activeSockets.set(number, socket);
      socket.ev.on('creds.update', saveCreds);

      socket.ev.on('connection.update', async ({ connection }) => {
        if (connection === 'open') {
          await setupMessageHandler(socket);
          try {
            await socket.sendMessage(number + '@s.whatsapp.net', {
              text: '*✅ SATANIC MINI Connected!*\n\nType *.menu* to see all commands.'
            });
          } catch {}
        }
        if (connection === 'close') {
          activeSockets.delete(number);
          try { fse.removeSync(sessionPath); } catch {}
        }
      });

      if (!socket.authState.creds.registered) {
        let code, retries = 3;
        while (retries > 0) {
          try { await delay(1500); code = await socket.requestPairingCode(number); break; }
          catch { retries--; await delay(2000 * (3 - retries)); }
        }
        if (!code) return res.status(503).json({ code: 'Service Unavailable' });
        return res.json({ code });
      }
      return res.json({ code: 'Already Registered' });
    } catch (err) {
      console.error('Pair error:', err);
      return res.status(503).json({ code: 'Service Unavailable' });
    }
  });

  module.exports = router;
  