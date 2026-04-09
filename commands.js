const { isAdmin, isOwner, handleAntiBadwordCommand, checkBadword } = require('./lib');
  const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
  const fse = require('fs-extra');
  const path = require('path');
  const fetch = require('node-fetch');

  // ─── In-memory settings ───
  const antilinkSettings  = new Map();
  const antitagSettings   = new Map();
  const antideleteEnabled = new Map();
  const messageStore      = new Map();

  // ══════════════════════════════════════════════
  // GENERAL COMMANDS
  // ══════════════════════════════════════════════

  async function aliveCommand(sock, chatId, message) {
    await sock.sendMessage(chatId, {
      text: `*🤖 SATANIC MINI is Active!*\n\n*Version:* 1.0.0\n*Status:* Online ✅\n\nType *.menu* for all commands`
    }, { quoted: message });
  }

  async function menuCommand(sock, chatId, message) {
    await sock.sendMessage(chatId, {
      text: `╔══════════════════╗
  ║  *🤖 SATANIC MINI MENU*  ║
  ╚══════════════════╝

  ╭─ 🛠️ *GENERAL*
  │ .alive — Bot status
  │ .menu — This menu
  │ .goodnight — Goodnight msg
  │ .flirt — Flirt message
  ╰────────────────

  ╭─ 👥 *GROUP MANAGEMENT*
  │ .tagall — Tag all members
  │ .tag <text> — Tag w/ message
  │ .hidetag <text> — Silent tag
  │ .groupinfo — Group info
  │ .setgname <name> — Set name
  │ .setgdesc <desc> — Set description
  │ .setgpp — Set group photo (reply img)
  ╰────────────────

  ╭─ 🔰 *PROTECTION*
  │ .antilink on/off/set delete|kick|warn
  │ .antitag on/off/set delete|kick
  │ .antidelete on/off (owner only)
  │ .antibadword add/remove/list/clear
  ╰────────────────

  _© SATANIC MINI — Pair Code Powered_`
    }, { quoted: message });
  }

  async function goodnightCommand(sock, chatId, message) {
    try {
      const res = await fetch('https://shizoapi.onrender.com/api/texts/lovenight?apikey=shizo');
      const json = await res.json();
      await sock.sendMessage(chatId, { text: json.result || '🌙 Good Night! Sweet Dreams 💤' }, { quoted: message });
    } catch { await sock.sendMessage(chatId, { text: '🌙 Good Night! Sweet Dreams 💤' }, { quoted: message }); }
  }

  async function flirtCommand(sock, chatId, message) {
    try {
      const res = await fetch('https://shizoapi.onrender.com/api/texts/flirt?apikey=shizo');
      const json = await res.json();
      await sock.sendMessage(chatId, { text: json.result || '😘 You are amazing!' }, { quoted: message });
    } catch { await sock.sendMessage(chatId, { text: '😘 You are simply amazing!' }, { quoted: message }); }
  }

  // ══════════════════════════════════════════════
  // GROUP COMMANDS
  // ══════════════════════════════════════════════

  async function tagAllCommand(sock, chatId, senderId, message) {
    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
    if (!isBotAdmin) return sock.sendMessage(chatId, { text: 'Please make the bot an admin first.' }, { quoted: message });
    if (!isSenderAdmin) return sock.sendMessage(chatId, { text: 'Only group admins can use .tagall.' }, { quoted: message });
    const meta = await sock.groupMetadata(chatId);
    let text = '🔊 *Hello Everyone:*\n\n';
    meta.participants.forEach(p => { text += `@${p.id.split('@')[0]}\n`; });
    await sock.sendMessage(chatId, { text, mentions: meta.participants.map(p => p.id) });
  }

  async function tagCommand(sock, chatId, senderId, args, replyMessage, message) {
    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
    if (!isBotAdmin) return sock.sendMessage(chatId, { text: 'Please make the bot an admin first.' }, { quoted: message });
    if (!isSenderAdmin) return sock.sendMessage(chatId, { text: 'Only admins can use .tag.' }, { quoted: message });
    const meta = await sock.groupMetadata(chatId);
    const mentions = meta.participants.map(p => p.id);
    const text = replyMessage?.conversation || replyMessage?.extendedTextMessage?.text || args || 'Tagged message';
    await sock.sendMessage(chatId, { text, mentions });
  }

  async function hideTagCommand(sock, chatId, senderId, args, replyMessage, message) {
    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
    if (!isBotAdmin) return sock.sendMessage(chatId, { text: 'Please make the bot an admin first.' }, { quoted: message });
    if (!isSenderAdmin) return sock.sendMessage(chatId, { text: 'Only admins can use .hidetag.' }, { quoted: message });
    const meta = await sock.groupMetadata(chatId);
    const nonAdmins = meta.participants.filter(p => !p.admin).map(p => p.id);
    const text = args || replyMessage?.conversation || replyMessage?.extendedTextMessage?.text || 'Tagged members.';
    await sock.sendMessage(chatId, { text, mentions: nonAdmins });
  }

  async function groupInfoCommand(sock, chatId, message) {
    try {
      const meta = await sock.groupMetadata(chatId);
      const admins = meta.participants.filter(p => p.admin);
      const listAdmin = admins.map((v, i) => `${i+1}. @${v.id.split('@')[0]}`).join('\n');
      const owner = meta.owner || admins.find(p => p.admin === 'superadmin')?.id || chatId;
      let pp = 'https://i.imgur.com/2wzGhpF.jpeg';
      try { pp = await sock.profilePictureUrl(chatId, 'image'); } catch {}
      const text = `┌──「 *GROUP INFO* 」\n▢ *Name:* ${meta.subject}\n▢ *Members:* ${meta.participants.length}\n▢ *Owner:* @${owner.split('@')[0]}\n▢ *Admins:*\n${listAdmin}\n▢ *Description:* ${meta.desc || 'None'}`;
      await sock.sendMessage(chatId, { image: { url: pp }, caption: text, mentions: [...admins.map(v => v.id), owner] });
    } catch { await sock.sendMessage(chatId, { text: 'Failed to get group info.' }, { quoted: message }); }
  }

  async function setGroupDescription(sock, chatId, senderId, text, message) {
    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
    if (!isBotAdmin || !isSenderAdmin) return sock.sendMessage(chatId, { text: 'Bot and sender must be admin.' }, { quoted: message });
    if (!text) return sock.sendMessage(chatId, { text: 'Usage: .setgdesc <description>' }, { quoted: message });
    try { await sock.groupUpdateDescription(chatId, text); await sock.sendMessage(chatId, { text: '✅ Description updated.' }, { quoted: message }); }
    catch { await sock.sendMessage(chatId, { text: '❌ Failed.' }, { quoted: message }); }
  }

  async function setGroupName(sock, chatId, senderId, text, message) {
    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
    if (!isBotAdmin || !isSenderAdmin) return sock.sendMessage(chatId, { text: 'Bot and sender must be admin.' }, { quoted: message });
    if (!text) return sock.sendMessage(chatId, { text: 'Usage: .setgname <name>' }, { quoted: message });
    try { await sock.groupUpdateSubject(chatId, text); await sock.sendMessage(chatId, { text: '✅ Group name updated.' }, { quoted: message }); }
    catch { await sock.sendMessage(chatId, { text: '❌ Failed.' }, { quoted: message }); }
  }

  async function setGroupPhoto(sock, chatId, senderId, message) {
    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
    if (!isBotAdmin || !isSenderAdmin) return sock.sendMessage(chatId, { text: 'Bot and sender must be admin.' }, { quoted: message });
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted?.imageMessage) return sock.sendMessage(chatId, { text: 'Reply to an image with .setgpp' }, { quoted: message });
    try {
      const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      const tmpPath = path.join(process.cwd(), `gpp_${Date.now()}.jpg`);
      require('fs').writeFileSync(tmpPath, buffer);
      await sock.updateProfilePicture(chatId, { url: tmpPath });
      try { require('fs').unlinkSync(tmpPath); } catch {}
      await sock.sendMessage(chatId, { text: '✅ Group photo updated.' }, { quoted: message });
    } catch { await sock.sendMessage(chatId, { text: '❌ Failed to update photo.' }, { quoted: message }); }
  }

  // ══════════════════════════════════════════════
  // PROTECTION COMMANDS
  // ══════════════════════════════════════════════

  async function antibadwordCommand(sock, chatId, message, senderId, text) {
    const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);
    if (!isSenderAdmin) return sock.sendMessage(chatId, { text: 'For Group Admins Only!' }, { quoted: message });
    const match = text.split(' ').slice(1).join(' ');
    await handleAntiBadwordCommand(sock, chatId, message, match);
  }

  async function handleAntilinkCommand(sock, chatId, message, senderId, text) {
    const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);
    if (!isSenderAdmin) return sock.sendMessage(chatId, { text: 'For Group Admins Only!' }, { quoted: message });
    const args = text.split(' ');
    const action = args[1];
    const current = antilinkSettings.get(chatId) || { enabled: false, action: 'delete' };
    if (!action) return sock.sendMessage(chatId, { text: `*ANTILINK*\nStatus: ${current.enabled ? '✅ ON' : '❌ OFF'}\nAction: ${current.action}\n\n.antilink on\n.antilink off\n.antilink set delete|kick|warn` }, { quoted: message });
    if (action === 'on') { antilinkSettings.set(chatId, { ...current, enabled: true }); return sock.sendMessage(chatId, { text: '✅ Antilink ON' }, { quoted: message }); }
    if (action === 'off') { antilinkSettings.set(chatId, { ...current, enabled: false }); return sock.sendMessage(chatId, { text: '❌ Antilink OFF' }, { quoted: message }); }
    if (action === 'set' && args[2]) {
      if (!['delete','kick','warn'].includes(args[2])) return sock.sendMessage(chatId, { text: 'Choose: delete, kick, or warn' }, { quoted: message });
      antilinkSettings.set(chatId, { ...current, action: args[2] });
      return sock.sendMessage(chatId, { text: `✅ Antilink action: ${args[2]}` }, { quoted: message });
    }
  }

  async function handleLinkDetection(sock, chatId, message, text, senderId) {
    const cfg = antilinkSettings.get(chatId);
    if (!cfg || !cfg.enabled) return;
    if (!/https?:\/\/\S+|www\.\S+|chat\.whatsapp\.com\/[A-Za-z0-9]+/i.test(text)) return;
    const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);
    if (isSenderAdmin) return;
    try { await sock.sendMessage(chatId, { delete: { remoteJid: chatId, fromMe: false, id: message.key.id, participant: message.key.participant || senderId } }); } catch {}
    if (cfg.action === 'kick') { await sock.groupParticipantsUpdate(chatId, [senderId], 'remove'); await sock.sendMessage(chatId, { text: `🚫 @${senderId.split('@')[0]} kicked for sending a link.`, mentions: [senderId] }); }
    else if (cfg.action === 'warn') { await sock.sendMessage(chatId, { text: `⚠️ @${senderId.split('@')[0]} don't send links!`, mentions: [senderId] }); }
    else { await sock.sendMessage(chatId, { text: `⚠️ @${senderId.split('@')[0]} links are not allowed.`, mentions: [senderId] }); }
  }

  async function handleAntitagCommand(sock, chatId, message, senderId, text) {
    const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);
    if (!isSenderAdmin) return sock.sendMessage(chatId, { text: 'For Group Admins Only!' }, { quoted: message });
    const args = text.split(' ');
    const action = args[1];
    const current = antitagSettings.get(chatId) || { enabled: false, action: 'delete' };
    if (!action) return sock.sendMessage(chatId, { text: `*ANTITAG*\nStatus: ${current.enabled ? '✅ ON' : '❌ OFF'}\nAction: ${current.action}\n\n.antitag on\n.antitag off\n.antitag set delete|kick` }, { quoted: message });
    if (action === 'on') { antitagSettings.set(chatId, { ...current, enabled: true }); return sock.sendMessage(chatId, { text: '✅ Antitag ON' }, { quoted: message }); }
    if (action === 'off') { antitagSettings.set(chatId, { ...current, enabled: false }); return sock.sendMessage(chatId, { text: '❌ Antitag OFF' }, { quoted: message }); }
    if (action === 'set' && args[2]) {
      if (!['delete','kick'].includes(args[2])) return sock.sendMessage(chatId, { text: 'Choose: delete or kick' }, { quoted: message });
      antitagSettings.set(chatId, { ...current, action: args[2] });
      return sock.sendMessage(chatId, { text: `✅ Antitag action: ${args[2]}` }, { quoted: message });
    }
  }

  async function handleTagDetection(sock, chatId, message, senderId) {
    const cfg = antitagSettings.get(chatId);
    if (!cfg || !cfg.enabled) return;
    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const meta = await sock.groupMetadata(chatId);
    if (mentioned.length < Math.ceil(meta.participants.length * 0.5)) return;
    const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);
    if (isSenderAdmin) return;
    try { await sock.sendMessage(chatId, { delete: { remoteJid: chatId, fromMe: false, id: message.key.id, participant: message.key.participant || senderId } }); } catch {}
    if (cfg.action === 'kick') { await sock.groupParticipantsUpdate(chatId, [senderId], 'remove'); await sock.sendMessage(chatId, { text: `🚫 @${senderId.split('@')[0]} kicked for tagging all.`, mentions: [senderId] }); }
    else { await sock.sendMessage(chatId, { text: `⚠️ @${senderId.split('@')[0]} Tagall not allowed!`, mentions: [senderId] }); }
  }

  async function handleAntideleteCommand(sock, chatId, message, senderId, text) {
    if (!isOwner(senderId)) return sock.sendMessage(chatId, { text: 'Only the bot owner can use this.' }, { quoted: message });
    const match = text.split(' ')[1];
    if (!match) return sock.sendMessage(chatId, { text: `*ANTIDELETE*\nStatus: ${antideleteEnabled.get(chatId) ? '✅ ON' : '❌ OFF'}\n\n.antidelete on\n.antidelete off` }, { quoted: message });
    if (match === 'on') { antideleteEnabled.set(chatId, true); return sock.sendMessage(chatId, { text: '✅ Antidelete enabled' }, { quoted: message }); }
    if (match === 'off') { antideleteEnabled.set(chatId, false); return sock.sendMessage(chatId, { text: '❌ Antidelete disabled' }, { quoted: message }); }
  }

  async function storeMessage(sock, message) {
    const chatId = message.key.remoteJid;
    if (!antideleteEnabled.get(chatId)) return;
    const id = message.key.id;
    const sender = message.key.participant || message.key.remoteJid;
    const content = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    messageStore.set(id, { content, sender, chatId, timestamp: new Date().toISOString() });
  }

  async function handleMessageRevocation(sock, update) {
    try {
      const chatId = update.key?.remoteJid;
      if (!chatId || !antideleteEnabled.get(chatId)) return;
      const id = update.update?.message?.protocolMessage?.key?.id;
      if (!id) return;
      const original = messageStore.get(id);
      if (!original) return;
      const ownerNum = sock.user.id.split(':')[0] + '@s.whatsapp.net';
      const deletedBy = update.key?.participant || update.key?.remoteJid;
      if (!deletedBy || deletedBy === ownerNum) return;
      let text = `*🔰 ANTIDELETE*\n*Deleted by:* @${deletedBy.split('@')[0]}\n*Sender:* @${original.sender.split('@')[0]}`;
      if (original.content) text += `\n\n*Message:*\n${original.content}`;
      await sock.sendMessage(ownerNum, { text, mentions: [deletedBy, original.sender] });
      messageStore.delete(id);
    } catch (e) { console.error('antidelete error:', e); }
  }

  module.exports = {
    aliveCommand, menuCommand, goodnightCommand, flirtCommand,
    tagAllCommand, tagCommand, hideTagCommand, groupInfoCommand,
    setGroupDescription, setGroupName, setGroupPhoto,
    antibadwordCommand,
    handleAntilinkCommand, handleLinkDetection,
    handleAntitagCommand, handleTagDetection,
    handleAntideleteCommand, storeMessage, handleMessageRevocation,
    checkBadword,
  };
  