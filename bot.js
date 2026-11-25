require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const store = require('./db');
const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) { console.error('BOT_TOKEN is required'); process.exit(1); }
const ADMIN_TG_ID = Number(process.env.ADMIN_TG_ID || 0);
const bot = new TelegramBot(TOKEN, { polling: true });
const searchMode = new Set();
const isAdmin = (msg) => { const id = msg.from && msg.from.id; if (!ADMIN_TG_ID || id === ADMIN_TG_ID) return true; bot.sendMessage(msg.chat.id, 'Доступ только для администратора бота.'); return false; };
const esc = (s) => String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const userCard = (u) => '👤 <b>'+esc(u.email)+'</b>\nИмя: '+esc(u.name||'—')+'\nРоль: '+(u.role==='admin'?'🛡 admin':'user')+'\nСтатус: '+(u.blocked?'⛔ заблокирован':'✅ активен')+'\nСканирования: '+u.scans_used+'/'+u.scans_limit;
const cardKeyboard = (u) => ({ inline_keyboard: [
 [{ text: u.role==='admin'?'Снять админ':'Выдать админ', callback_data:'role:'+u.email+':'+(u.role==='admin'?'user':'admin') }],
 [{ text: u.blocked?'Разблокировать':'Заблокировать', callback_data:'block:'+u.email+':'+(u.blocked?0:1) }],
 [{ text:'Лимит 50', callback_data:'limit:'+u.email+':50' },{ text:'Лимит 200', callback_data:'limit:'+u.email+':200' }],
 [{ text:'Удалить', callback_data:'del:'+u.email }],
 [{ text:'« К списку', callback_data:'users:0' }]
]});
const usersKeyboard = (offset) => {
 const rows = store.listUsers(10,offset).map(u=>[{text:(u.role==='admin'?'🛡 ':'• ')+u.email,callback_data:'card:'+u.email}]);
 const total=store.countUsers(); const nav=[];
 if(offset>0) nav.push({text:'« Назад',callback_data:'users:'+Math.max(0,offset-10)});
 if(offset+10<total) nav.push({text:'Вперёд »',callback_data:'users:'+(offset+10)});
 if(nav.length) rows.push(nav);
 rows.push([{text:'🔍 Поиск почты',callback_data:'search'},{text:'📊 Статистика',callback_data:'stats'}]);
 return {inline_keyboard:rows};
};
bot.onText(/^\/start/, msg => {
 if(!isAdmin(msg)) return;
 bot.sendMessage(msg.chat.id,'HabitLife Admin Panel\nВыберите действие:',{reply_markup:{inline_keyboard:[
  [{text:'👥 Пользователи',callback_data:'users:0'},{text:'🔍 Поиск',callback_data:'search'}],
  [{text:'📊 Статистика',callback_data:'stats'},{text:'➕ Добавить',callback_data:'add'}],
  [{text:'ℹ️ Команды',callback_data:'help'}]]}});
});
bot.onText(/^\/users/, msg => { if(isAdmin(msg)) bot.sendMessage(msg.chat.id,'Пользователи:',{reply_markup:usersKeyboard(0)}); });
bot.onText(/^\/stats/, msg => { if(!isAdmin(msg))return; const s=store.stats(); bot.sendMessage(msg.chat.id,'Пользователей: '+s.users+'\nАдминов: '+s.admins+'\nЗаблокировано: '+s.blocked+'\nСканирований: '+s.scans); });
bot.onText(/^\/find (.+)/, (msg,m)=>{ if(!isAdmin(msg))return; const found=store.findUsers(m[1].trim()); if(!found.length)return bot.sendMessage(msg.chat.id,'Ничего не найдено.'); bot.sendMessage(msg.chat.id,'Найдено:',{reply_markup:{inline_keyboard:found.map(u=>[{text:u.email+(u.role==='admin'?' 🛡':''),callback_data:'card:'+u.email}])}}); });
bot.onText(/^\/add (\S+) (.*)/, (msg,m)=>{ if(!isAdmin(msg))return; const email=m[1].toLowerCase(); if(!/^\S+@\S+\.\S+$/.test(email))return bot.sendMessage(msg.chat.id,'Некорректная почта.'); store.addUser(email,m[2]||''); const u=store.getUser(email); bot.sendMessage(msg.chat.id,userCard(u),{parse_mode:'HTML',reply_markup:cardKeyboard(u)}); });
bot.onText(/^\/grant (.+)/, (msg,m)=>{ if(!isAdmin(msg))return; const email=m[1].trim().toLowerCase(); if(!store.getUser(email))return bot.sendMessage(msg.chat.id,'Пользователь не найден.'); store.setRole(email,'admin'); bot.sendMessage(msg.chat.id,'Роль admin выдана: '+email); });
bot.onText(/^\/revoke (.+)/, (msg,m)=>{ if(!isAdmin(msg))return; const email=m[1].trim().toLowerCase(); store.setRole(email,'user'); bot.sendMessage(msg.chat.id,'Роль admin снята: '+email); });
const edit = (q, text, extra={}) => bot.editMessageText(text, Object.assign({chat_id:q.message.chat.id,message_id:q.message.message_id},extra));
bot.on('callback_query', q => {
 const data=q.data||''; const chat=q.message.chat.id; bot.answerCallbackQuery(q.id);
 if(data.startsWith('users:')) return edit(q,'Пользователи:',{reply_markup:usersKeyboard(Number(data.split(':')[1]))});
 if(data==='stats'){const s=store.stats();return edit(q,'Пользователей: '+s.users+'\nАдминов: '+s.admins+'\nЗаблокировано: '+s.blocked+'\nСканирований: '+s.scans);}
 if(data==='search'){searchMode.add(chat);return bot.sendMessage(chat,'Отправьте почту или часть имени:');}
 if(data==='help')return edit(q,'/users — список\n/find email — поиск\n/add email name — добавить\n/grant email — выдать админ\n/revoke email — снять админ\n/stats — статистика');
 if(data==='add'){searchMode.add(chat+':add');return bot.sendMessage(chat,'Отправьте: email Имя');}
 if(data.startsWith('card:')){const u=store.getUser(data.split(':')[1]);if(!u)return bot.sendMessage(chat,'Не найден.');return edit(q,userCard(u),{parse_mode:'HTML',reply_markup:cardKeyboard(u)});}
 if(data.startsWith('role:')){const p=data.split(':');store.setRole(p[1],p[2]);const u=store.getUser(p[1]);return edit(q,userCard(u),{parse_mode:'HTML',reply_markup:cardKeyboard(u)});}
 if(data.startsWith('block:')){const p=data.split(':');store.setBlocked(p[1],p[2]==='1');const u=store.getUser(p[1]);return edit(q,userCard(u),{parse_mode:'HTML',reply_markup:cardKeyboard(u)});}
 if(data.startsWith('limit:')){const p=data.split(':');store.setLimit(p[1],Number(p[2]));const u=store.getUser(p[1]);return edit(q,userCard(u),{parse_mode:'HTML',reply_markup:cardKeyboard(u)});}
 if(data.startsWith('del:')){const email=data.split(':').slice(1).join(':');store.removeUser(email);return edit(q,'Удалено: '+email,{reply_markup:usersKeyboard(0)});}
});
bot.on('text', msg => {
 const chat=msg.chat.id;
 if(searchMode.has(chat)){searchMode.delete(chat);const found=store.findUsers(msg.text.trim());return bot.sendMessage(chat,found.length?'Найдено:':'Ничего не найдено.',found.length?{reply_markup:{inline_keyboard:found.map(u=>[{text:u.email+(u.role==='admin'?' 🛡':''),callback_data:'card:'+u.email}])}}:{});}
 if(searchMode.has(chat+':add')){searchMode.delete(chat+':add');const parts=msg.text.trim().split(/\s+/);if(!/^\S+@\S+\.\S+$/.test(parts[0]))return bot.sendMessage(chat,'Некорректная почта.');store.addUser(parts[0].toLowerCase(),parts.slice(1).join(' '));const u=store.getUser(parts[0].toLowerCase());return bot.sendMessage(chat,userCard(u),{parse_mode:'HTML',reply_markup:cardKeyboard(u)});}
});
console.log('HabitLife admin bot started');
