const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(process.env.DB_PATH || path.join(__dirname, 'habitlife.db'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
  blocked INTEGER NOT NULL DEFAULT 0,
  scans_limit INTEGER NOT NULL DEFAULT 6,
  scans_used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);
const seed = process.env.SEED_ADMIN_EMAIL;
if (seed) db.prepare("INSERT INTO users(email,name,role) VALUES(?, 'Admin', 'admin') ON CONFLICT(email) DO UPDATE SET role='admin'").run(seed.trim().toLowerCase());
const listUsers = (limit=20, offset=0) => db.prepare('SELECT email,name,role,blocked,scans_limit,scans_used FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
const countUsers = () => db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
const findUsers = (q) => db.prepare('SELECT email,name,role,blocked,scans_limit,scans_used FROM users WHERE lower(email) LIKE ? OR lower(name) LIKE ? ORDER BY email LIMIT 30').all('%'+q.toLowerCase()+'%','%'+q.toLowerCase()+'%');
const getUser = (email) => db.prepare('SELECT * FROM users WHERE email = ?').get(email);
const addUser = (email,name) => db.prepare('INSERT INTO users(email,name) VALUES(?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name').run(email,name);
const setRole = (email,role) => db.prepare('UPDATE users SET role=? WHERE email=?').run(role,email);
const setBlocked = (email,v) => db.prepare('UPDATE users SET blocked=? WHERE email=?').run(v?1:0,email);
const setLimit = (email,n) => db.prepare('UPDATE users SET scans_limit=? WHERE email=?').run(n,email);
const removeUser = (email) => db.prepare('DELETE FROM users WHERE email=?').run(email);
const stats = () => ({ users: countUsers(), admins: db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").get().n, blocked: db.prepare('SELECT COUNT(*) AS n FROM users WHERE blocked=1').get().n, scans: db.prepare('SELECT COALESCE(SUM(scans_used),0) AS n FROM users').get().n });
module.exports = { db, listUsers, countUsers, findUsers, getUser, addUser, setRole, setBlocked, setLimit, removeUser, stats };
