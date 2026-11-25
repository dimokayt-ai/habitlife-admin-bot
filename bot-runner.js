const fs = require('fs');
const TOKEN = process.env.BOT_TOKEN;
const ADMINS = (process.env.ADMIN_TG_IDS || '7001764913,8634323012').split(',').map(s => s.trim()).filter(Boolean);
if (!TOKEN) { console.error('BOT_TOKEN missing'); process.exit(1); }

const api = async (m, p) => {
  const r = await fetch('https://api.telegram.org/bot' + TOKEN + '/' + m, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p || {})
  });
  return r.json();
};
const load = f => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
const save = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2));
const users = load('data/users.json') || {};
const state = load('data/state.json') || { offset: 0 };
const norm = e => String(e || '').trim().toLowerCase();
const isAdmin = id => ADMINS.includes(String(id));

const kb = u => ({
  inline_keyboard: [
    [{ text: u.role === 'admin' ? 'Снять админ' : 'Выдать админ', callback_data: 'role:' + u.email + ':' + (u.role === 'admin' ? 'user' : 'admin') }],
    [{ text: u.blocked ? 'Разблокировать' : 'Заблокировать', callback_data: 'block:' + u.email + ':' + (u.blocked ? 0 : 1) }],
    [{ text: 'Лимит 50', callback_data: 'limit:' + u.email + ':50' }, { text: 'Лимит 200', callback_data: 'limit:' + u.email + ':200' }],
    [{ text: 'Удалить', callback_data: 'del:' + u.email }],
    [{ text: '« К списку', callback_data: 'users:0' }]
  ]
});
const card = u => '👤 <b>' + u.email + '</b>\nРоль: ' + (u.role === 'admin' ? '🛡 admin' : 'user') +
  '\nСтатус: ' + (u.blocked ? '⛔ заблокирован' : '✅ активен') + '\nСканирования: ' + (u.scans_used || 0) + '/' + (u.scans_limit || 6);
const listKb = off => {
  const arr = Object.values(users);
  const rows = arr.slice(off, off + 10).map(u => [{ text: (u.role === 'admin' ? '🛡 ' : '• ') + u.email, callback_data: 'card:' + u.email }]);
  if (off > 0) rows.push([{ text: '« Назад', callback_data: 'users:' + Math.max(0, off - 10) }]);
  if (off + 10 < arr.length) rows.push([{ text: 'Вперёд »', callback_data: 'users:' + (off + 10) }]);
  rows.push([{ text: '🔍 Поиск', callback_data: 'search' }, { text: '📊 Статистика', callback_data: 'stats' }]);
  return { inline_keyboard: rows };
};
const ensure = e => {
  e = norm(e);
  if (!users[e]) users[e] = { email: e, name: '', role: 'user', blocked: false, scans_limit: 6, scans_used: 0 };
  return users[e];
};
const send = (chat, text, extra = {}) => api('sendMessage', Object.assign({ chat_id: chat, text, parse_mode: 'HTML' }, extra));

async function handleMessage(m) {
  const chat = m.chat.id;
  const text = (m.text || '').trim();
  if (!isAdmin(m.from.id)) return send(chat, 'Доступ только для администратора бота.');

  if (text.startsWith('/start')) {
    const payload = text.slice(6).trim();
    if (payload.startsWith('grant:')) { ensure(payload.slice(6)).role = 'admin'; return send(chat, 'Админ выдан: ' + payload.slice(6)); }
    if (payload.startsWith('revoke:')) { ensure(payload.slice(7)).role = 'user'; return send(chat, 'Админ снят: ' + payload.slice(7)); }
    return send(chat, 'HabitLife Admin Panel', { reply_markup: { inline_keyboard: [
      [{ text: '🌐 Открыть панель', web_app: { url: 'https://dimokayt-ai.github.io/habitlife-admin-web/' } }],
      [{ text: '👥 Пользователи', callback_data: 'users:0' }, { text: '🔍 Поиск', callback_data: 'search' }],
      [{ text: '📊 Статистика', callback_data: 'stats' }]
    ] } });
  }
  if (text.startsWith('/users')) return send(chat, 'Пользователи:', { reply_markup: listKb(0) });
  if (text.startsWith('/stats')) {
    const a = Object.values(users);
    return send(chat, 'Пользователей: ' + a.length + '\nАдминов: ' + a.filter(x => x.role === 'admin').length +
      '\nЗаблокировано: ' + a.filter(x => x.blocked).length);
  }
  if (text.startsWith('/find ')) {
    const q = norm(text.slice(6));
    const found = Object.values(users).filter(u => u.email.includes(q) || (u.name || '').toLowerCase().includes(q));
    if (!found.length) return send(chat, 'Ничего не найдено.');
    return send(chat, 'Найдено:', { reply_markup: { inline_keyboard: found.map(u => [{ text: u.email, callback_data: 'card:' + u.email }]) } });
  }
  if (text.startsWith('/add ')) {
    const parts = text.slice(5).trim().split(/\s+/);
    if (!/^\S+@\S+\.\S+$/.test(parts[0])) return send(chat, 'Некорректная почта.');
    const u = ensure(parts[0]); u.name = parts.slice(1).join(' ');
    return send(chat, card(u), { reply_markup: kb(u) });
  }
  if (text.startsWith('/grant ')) {
    const email = norm(text.slice(7));
    if (email !== 'dimokayt@gmail.com' && !ADMINS.includes(String(m.from.id)))
      return send(chat, 'Только для админа бота.');
    ensure(email).role = 'admin';
    return send(chat, 'Админ выдан: ' + email);
  }
  if (text.startsWith('/revoke ')) {
    const email = norm(text.slice(8));
    ensure(email).role = 'user';
    return send(chat, 'Админ снят: ' + email);
  }
  if (/^ID: (\d+)$/i.test(text) || /^\d{6,}$/.test(text)) {
    const id = (text.match(/(\d{6,})/) || [])[1];
    if (id && !ADMINS.includes(id)) { ADMINS.push(id); return send(chat, 'Добавлен Telegram ID: ' + id); }
  }
  return send(chat, 'Команды: /start /users /stats /find email /add email name /grant email /revoke email');
}

async function handleCallback(q) {
  const data = q.data || '';
  const chat = q.message.chat.id, mid = q.message.message_id;
  await api('answerCallbackQuery', { callback_query_id: q.id });
  if (data.startsWith('users:')) return api('editMessageText', { chat_id: chat, message_id: mid, text: 'Пользователи:', reply_markup: listKb(Number(data.split(':')[1])) });
  if (data === 'stats') {
    const a = Object.values(users);
    return api('editMessageText', { chat_id: chat, message_id: mid, text: 'Пользователей: ' + a.length + '\nАдминов: ' + a.filter(x => x.role === 'admin').length });
  }
  if (data === 'search') return send(chat, 'Отправьте поисковый запрос:');
  if (data.startsWith('card:')) {
    const u = users[norm(data.slice(5))];
    return u ? api('editMessageText', { chat_id: chat, message_id: mid, text: card(u), parse_mode: 'HTML', reply_markup: kb(u) }) : send(chat, 'Не найден');
  }
  if (data.startsWith('role:')) {
    const p = data.split(':');
    const u = ensure(p[1]); u.role = p[2] === 'admin' ? 'admin' : 'user';
    return api('editMessageText', { chat_id: chat, message_id: mid, text: card(u), parse_mode: 'HTML', reply_markup: kb(u) });
  }
  if (data.startsWith('block:')) {
    const p = data.split(':');
    const u = ensure(p[1]); u.blocked = p[2] === '1';
    return api('editMessageText', { chat_id: chat, message_id: mid, text: card(u), parse_mode: 'HTML', reply_markup: kb(u) });
  }
  if (data.startsWith('limit:')) {
    const p = data.split(':');
    const u = ensure(p[1]); u.scans_limit = Number(p[2]) || 6;
    return api('editMessageText', { chat_id: chat, message_id: mid, text: card(u), parse_mode: 'HTML', reply_markup: kb(u) });
  }
  if (data.startsWith('del:')) {
    delete users[norm(data.slice(4))];
    return api('editMessageText', { chat_id: chat, message_id: mid, text: 'Удалено' });
  }
}

(async () => {
  const r = await api('getUpdates', { offset: state.offset, timeout: 10 });
  for (const u of (r.result || [])) {
    state.offset = Math.max(state.offset, u.update_id + 1);
    try {
      if (u.message) await handleMessage(u.message);
      if (u.callback_query) await handleCallback(u.callback_query);
    } catch (e) { console.error(e); }
  }
  if (!users['dimokayt@gmail.com']) ensure('dimokayt@gmail.com').role = 'admin';
  save('data/users.json', users);
  save('data/state.json', state);
})();

