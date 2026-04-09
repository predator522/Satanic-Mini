const config = require('./config');

  async function isAdmin(sock, chatId, senderId) {
    try {
      const meta = await sock.groupMetadata(chatId);
      const p = meta.participants || [];
      const sender = p.find(x => x.id === senderId || x.id.split('@')[0] === senderId.split('@')[0]);
      const isSenderAdmin = sender?.admin === 'admin' || sender?.admin === 'superadmin';
      const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
      const bot = p.find(x => x.id === botId || x.id.split('@')[0] === botId.split('@')[0]);
      const isBotAdmin = bot?.admin === 'admin' || bot?.admin === 'superadmin';
      return { isSenderAdmin, isBotAdmin };
    } catch { return { isSenderAdmin: false, isBotAdmin: false }; }
  }

  function isOwner(senderId) {
    const ownerNum = (config.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
    const senderNum = senderId.replace(/[^0-9]/g, '').split('@')[0];
    return !!(ownerNum && senderNum.includes(ownerNum));
  }

  const badwordLists = new Map();
  async function handleAntiBadwordCommand(sock, chatId, message, match) {
    if (!match) {
      const words = badwordLists.get(chatId);
      const list = words && words.size ? [...words].join(', ') : 'None';
      return sock.sendMessage(chatId, { text: `*ANTIBADWORD*\nBanned: ${list}\n\n.antibadword add <word>\n.antibadword remove <word>\n.antibadword list\n.antibadword clear` }, { quoted: message });
    }
    const [action, ...rest] = match.trim().split(' ');
    const word = rest.join(' ').toLowerCase().trim();
    let words = badwordLists.get(chatId) || new Set();
    if (action === 'add' && word) { words.add(word); badwordLists.set(chatId, words); return sock.sendMessage(chatId, { text: `✅ Added "${word}"` }, { quoted: message }); }
    if (action === 'remove' && word) { words.delete(word); badwordLists.set(chatId, words); return sock.sendMessage(chatId, { text: `✅ Removed "${word}"` }, { quoted: message }); }
    if (action === 'list') { return sock.sendMessage(chatId, { text: `*Bad Words:* ${words.size ? [...words].join(', ') : 'None'}` }, { quoted: message }); }
    if (action === 'clear') { badwordLists.set(chatId, new Set()); return sock.sendMessage(chatId, { text: '✅ Cleared.' }, { quoted: message }); }
  }
  async function checkBadword(sock, chatId, message, text) {
    const words = badwordLists.get(chatId);
    if (!words || !words.size) return;
    for (const w of words) {
      if (text.toLowerCase().includes(w)) {
        try { await sock.sendMessage(chatId, { delete: { remoteJid: chatId, fromMe: false, id: message.key.id, participant: message.key.participant || message.key.remoteJid } }); } catch {}
        const sender = message.key.participant || message.key.remoteJid;
        await sock.sendMessage(chatId, { text: `⚠️ @${sender.split('@')[0]} watch your language!`, mentions: [sender] });
        return;
      }
    }
  }

  module.exports = { isAdmin, isOwner, handleAntiBadwordCommand, checkBadword };
  