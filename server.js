const express = require('express');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SECRET_FILE = path.join(DATA_DIR, 'session.secret');
const DOWNLOAD_DIR = path.join(__dirname, 'download');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
['user1', 'user2', 'user3'].forEach(u => {
  const p = path.join(DOWNLOAD_DIR, u);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// ===== Password hashing =====
function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}
function verifyPassword(password, stored) {
  const { hash } = hashPassword(password, stored.salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(stored.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ===== Bootstrap users =====
const emptyUser = (name, role, nim) => ({
  password: hashPassword(nim.slice(-1) + 'pass'),
  nim, name, role,
  avatar: '', // <-- Added avatar field
  profile: '', contact: { email: '', phone: '', location: '', linkedin: '', github: '' },
  education: [], experience: [], abilities: [], projectLink: '', projects: []
});

let usersData;
if (!fs.existsSync(USERS_FILE)) {
  usersData = {
    masterPassword: hashPassword('capstone12'),
    users: {
      user1: emptyUser('Nama User 1', 'Frontend Developer', '220010001'),
      user2: emptyUser('Nama User 2', 'Backend Developer',  '220010002'),
      user3: emptyUser('Nama User 3', 'UI/UX Designer',     '220010003')
    }
  };
  fs.writeFileSync(USERS_FILE, JSON.stringify(usersData, null, 2));
} else {
  usersData = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  // Migrate old data to include avatar
  Object.values(usersData.users).forEach(u => { if (u.avatar === undefined) u.avatar = ''; });
}
function saveUsers() { fs.writeFileSync(USERS_FILE, JSON.stringify(usersData, null, 2)); }

// ===== Session secret =====
let sessionSecret;
if (fs.existsSync(SECRET_FILE)) sessionSecret = fs.readFileSync(SECRET_FILE, 'utf8');
else {
  sessionSecret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_FILE, sessionSecret);
}

// ===== Security Middleware =====
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', apiLimiter);
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
app.use('/api/login', loginLimiter);
app.use('/api/password', loginLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/download', express.static(DOWNLOAD_DIR));
app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/secret.html', (req, res) => res.sendFile(path.join(__dirname, 'secret.html')));

// Auth guards
function requireAuth(req, res, next) {
  if (!req.session || (!req.session.userId && req.session.role !== 'master')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
function requireMaster(req, res, next) {
  if (!req.session || req.session.role !== 'master') {
    return res.status(403).json({ error: 'Master access required' });
  }
  next();
}
function canAccess(req, userId) {
  return req.session.role === 'master' || req.session.userId === userId;
}

// ===== Multer (File Uploads) =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(DOWNLOAD_DIR, req.params.userId);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const dir = path.join(DOWNLOAD_DIR, req.params.userId);
    const ext = path.extname(file.originalname).toLowerCase();
    let base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
    let name = base + ext, i = 1;
    while (fs.existsSync(path.join(dir, name))) {
      name = `${base}_${i}${ext}`; i++;
    }
    cb(null, name);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpeg', '.jpg'];
    if (!allowed.includes(path.extname(file.originalname).toLowerCase())) {
      return cb(new Error('Hanya format .pdf, .png, .jpeg yang diizinkan'));
    }
    cb(null, true);
  }
});

// Helpers
function listFiles(userId) {
  const dir = path.join(DOWNLOAD_DIR, userId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => ['.pdf', '.png', '.jpeg', '.jpg'].includes(path.extname(f).toLowerCase()))
    .map(f => {
      const s = fs.statSync(path.join(dir, f));
      return { name: f, size: s.size, uploadDate: s.mtime };
    });
}
function stripPassword(u) { const { password, ...rest } = u; return rest; }

// ===== API Routes =====
app.get('/api/users', (req, res) => {
  const out = {};
  for (const [id, u] of Object.entries(usersData.users)) {
    out[id] = { ...stripPassword(u), files: listFiles(id) };
  }
  res.json(out);
});

app.post('/api/login/user', (req, res) => {
  const { userId, password } = req.body || {};
  const u = usersData.users[userId];
  if (!u || !verifyPassword(password || '', u.password)) {
    return res.status(401).json({ error: 'ID Pengguna atau kata sandi salah' });
  }
  req.session.userId = userId; req.session.role = 'user';
  res.json({ success: true, userId, role: 'user' });
});
app.post('/api/login/master', (req, res) => {
  const { password } = req.body || {};
  if (!verifyPassword(password || '', usersData.masterPassword)) {
    return res.status(401).json({ error: 'Kata sandi Master salah' });
  }
  req.session.role = 'master'; req.session.userId = null;
  res.json({ success: true, role: 'master' });
});
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});
app.get('/api/session', (req, res) => {
  if (req.session && (req.session.userId || req.session.role === 'master')) {
    res.json({ loggedIn: true, userId: req.session.userId || null, role: req.session.role });
  } else res.json({ loggedIn: false });
});

app.get('/api/users/:id', requireAuth, (req, res) => {
  if (!canAccess(req, req.params.id)) return res.status(403).json({ error: 'Forbidden' });
  const u = usersData.users[req.params.id];
  if (!u) return res.status(404).json({ error: 'Tidak ditemukan' });
  res.json({ ...stripPassword(u), id: req.params.id, files: listFiles(req.params.id) });
});

app.put('/api/users/:id', requireAuth, (req, res) => {
  if (!canAccess(req, req.params.id)) return res.status(403).json({ error: 'Forbidden' });
  const u = usersData.users[req.params.id];
  if (!u) return res.status(404).json({ error: 'Tidak ditemukan' });
  // Added avatar to the list of editable fields
  ['nim','name','role','avatar','profile','contact','education','experience','abilities','projectLink','projects']
    .forEach(f => { if (req.body[f] !== undefined) u[f] = req.body[f]; });
  saveUsers();
  res.json({ success: true });
});

app.put('/api/password/user', requireAuth, (req, res) => {
  if (req.session.role !== 'user') return res.status(403).json({ error: 'Gunakan endpoint master' });
  const { currentPassword, newPassword } = req.body || {};
  const u = usersData.users[req.session.userId];
  if (!verifyPassword(currentPassword || '', u.password)) {
    return res.status(401).json({ error: 'Kata sandi saat ini salah' });
  }
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Minimal 6 karakter' });
  u.password = hashPassword(newPassword);
  saveUsers();
  res.json({ success: true });
});

app.put('/api/password/:id', requireMaster, (req, res) => {
  const u = usersData.users[req.params.id];
  if (!u) return res.status(404).json({ error: 'Tidak ditemukan' });
  if (!req.body.newPassword || req.body.newPassword.length < 6) {
    return res.status(400).json({ error: 'Minimal 6 karakter' });
  }
  u.password = hashPassword(req.body.newPassword);
  saveUsers();
  res.json({ success: true });
});

app.put('/api/password/master/change', requireMaster, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!verifyPassword(currentPassword || '', usersData.masterPassword)) {
    return res.status(401).json({ error: 'Kata sandi Master salah' });
  }
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Minimal 6 karakter' });
  usersData.masterPassword = hashPassword(newPassword);
  saveUsers();
  res.json({ success: true });
});

app.get('/api/files/:userId', requireAuth, (req, res) => {
  if (!canAccess(req, req.params.userId)) return res.status(403).json({ error: 'Forbidden' });
  res.json(listFiles(req.params.userId));
});

app.post('/api/files/:userId', requireAuth, (req, res) => {
  if (!canAccess(req, req.params.userId)) return res.status(403).json({ error: 'Forbidden' });
  upload.single('file')(req, res, err => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Ukuran file melebihi 5MB' });
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) return res.status(400).json({ error: 'Tidak ada file' });
    res.json({ success: true, file: { name: req.file.filename, size: req.file.size } });
  });
});

app.delete('/api/files/:userId/:filename', requireAuth, (req, res) => {
  if (!canAccess(req, req.params.userId)) return res.status(403).json({ error: 'Forbidden' });
  const { filename } = req.params;
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Nama file tidak valid' });
  }
  const fp = path.join(DOWNLOAD_DIR, req.params.userId, filename);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Tidak ditemukan' });
  fs.unlinkSync(fp);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server berjalan: http://localhost:${PORT}\n`);
  console.log('Kata sandi default:');
  console.log('  Master : capstone12');
  console.log('  User 1 : 1pass');
  console.log('  User 2 : 2pass');
  console.log('  User 3 : 3pass\n');
});