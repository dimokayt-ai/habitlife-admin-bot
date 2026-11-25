require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const store = require('./db');
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const INTERNAL = process.env.INTERNAL_TOKEN || 'internal-change-me';
const sign = u => jwt.sign({ sub:u.email, role:u.role, email:u.email }, JWT_SECRET, { expiresIn:'30d' });
app.get('/health', (_q,r)=>r.json({ok:true,service:'habitlife-api'}));
app.post('/auth/google', async (req,res)=>{
  const idToken=String(req.body?.idToken||'');
  if(!idToken) return res.status(400).json({error:'no_token'});
  try {
    const g=await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(idToken));
    if(!g.ok) return res.status(401).json({error:'invalid_token'});
    const info=await g.json();
    if(process.env.GOOGLE_WEB_CLIENT_ID && info.aud!==process.env.GOOGLE_WEB_CLIENT_ID) return res.status(401).json({error:'wrong_audience'});
    if(String(info.email_verified)!=='true') return res.status(401).json({error:'unverified'});
    const email=String(info.email).toLowerCase();
    const admin=(process.env.ADMIN_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).includes(email);
    store.addUser(email, info.name||'');
    if(admin) store.setRole(email,'admin');
    const u=store.getUser(email);
    if(u.blocked) return res.status(403).json({error:'blocked'});
    res.json({token:sign(u),user:{email:u.email,name:u.name,role:u.role}});
  } catch(e){ res.status(502).json({error:'verify_failed'}); }
});
app.get('/me',(req,res)=>{
  try { const p=jwt.verify(String(req.headers.authorization||'').replace(/^Bearer\s+/i,''),JWT_SECRET); const u=store.getUser(p.email); if(!u)return res.status(404).json({error:'no_user'}); res.json({user:{email:u.email,name:u.name,role:u.role},subscription:{scans_limit:u.scans_limit,scans_used:u.scans_used}}); }
  catch { res.status(401).json({error:'unauthorized'}); }
});
// Bot internal API: Telegram changes role/limits in the SAME DB the app reads.
app.get('/internal/users',(q,r)=>{ if(q.headers['x-internal-token']!==INTERNAL)return r.status(401).json({error:'unauthorized'}); r.json({items:store.listUsers(500,0)}); });
app.post('/internal/admin/role',(q,r)=>{ if(q.headers['x-internal-token']!==INTERNAL)return r.status(401).json({error:'unauthorized'}); const {email,role}=q.body||{}; store.setRole(String(email||'').toLowerCase(),role==='admin'?'admin':'user'); r.json({ok:true}); });
app.post('/internal/admin/limit',(q,r)=>{ if(q.headers['x-internal-token']!==INTERNAL)return r.status(401).json({error:'unauthorized'}); const {email,limit}=q.body||{}; store.setLimit(String(email||'').toLowerCase(),Number(limit)||6); r.json({ok:true}); });
app.post('/internal/admin/block',(q,r)=>{ if(q.headers['x-internal-token']!==INTERNAL)return r.status(401).json({error:'unauthorized'}); const {email,blocked}=q.body||{}; store.setBlocked(String(email||'').toLowerCase(),!!blocked); r.json({ok:true}); });
app.listen(Number(process.env.API_PORT||4000),()=>console.log('HabitLife API on :'+(process.env.API_PORT||4000)));
