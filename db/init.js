// ══════════════════════════════════════════════════
//  FOZILA — Initialisation base de données (sql.js)
//  Lancer une seule fois : node db/init.js
// ══════════════════════════════════════════════════

require('dotenv').config();
const bcrypt    = require('bcryptjs');
const initSqlJs = require('sql.js');
const path      = require('path');
const fs        = require('fs');

const DB_PATH = process.env.DB_PATH || './db/fozila.db';
const dbDir   = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

async function init() {
  const SQL = await initSqlJs();
  const db  = new SQL.Database();

  function save() {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }

  console.log('📦 Création des tables...');

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    email      TEXT    NOT NULL UNIQUE,
    phone      TEXT    DEFAULT '',
    password   TEXT    NOT NULL,
    is_admin   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS albums (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    artist      TEXT    NOT NULL DEFAULT 'Artiste Fozila',
    genre       TEXT    NOT NULL,
    tracks      INTEGER NOT NULL DEFAULT 1,
    year        INTEGER NOT NULL,
    price       INTEGER NOT NULL,
    emoji       TEXT    NOT NULL DEFAULT '🎵',
    grad        TEXT    NOT NULL DEFAULT 'linear-gradient(135deg,#1a0533,#4c1d95)',
    tag         TEXT    DEFAULT '',
    featured    INTEGER NOT NULL DEFAULT 0,
    sales       INTEGER NOT NULL DEFAULT 0,
    description TEXT    DEFAULT '',
    cover_path  TEXT    DEFAULT '',
    file_path   TEXT    DEFAULT '',
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS singles (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    artist     TEXT    NOT NULL DEFAULT 'Artiste Fozila',
    genre      TEXT    NOT NULL,
    price      INTEGER NOT NULL,
    duration   TEXT    NOT NULL DEFAULT '3:30',
    emoji      TEXT    NOT NULL DEFAULT '🎵',
    grad       TEXT    NOT NULL DEFAULT 'linear-gradient(135deg,#1a0533,#7c3aed)',
    featured   INTEGER NOT NULL DEFAULT 0,
    live       INTEGER NOT NULL DEFAULT 1,
    sales      INTEGER NOT NULL DEFAULT 0,
    cover_path TEXT    DEFAULT '',
    file_path  TEXT    DEFAULT '',
    is_active  INTEGER NOT NULL DEFAULT 1,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tracks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    album_id   INTEGER NOT NULL,
    title      TEXT    NOT NULL DEFAULT 'Titre',
    track_num  INTEGER NOT NULL DEFAULT 1,
    file_path  TEXT    NOT NULL DEFAULT '',
    duration   TEXT    DEFAULT '',
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS purchases (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL,
    item_id        INTEGER NOT NULL,
    item_type      TEXT    NOT NULL,
    amount         INTEGER NOT NULL,
    pay_method     TEXT    NOT NULL DEFAULT 'orange_money',
    pay_ref        TEXT    DEFAULT '',
    status         TEXT    NOT NULL DEFAULT 'completed',
    download_token TEXT    DEFAULT '',
    purchased_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS withdrawals (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    amount     INTEGER NOT NULL,
    method     TEXT    NOT NULL,
    phone      TEXT    NOT NULL,
    status     TEXT    NOT NULL DEFAULT 'pending',
    note       TEXT    DEFAULT '',
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS announcements (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    content    TEXT    NOT NULL,
    is_active  INTEGER NOT NULL DEFAULT 1,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  )`);

  console.log('✅ Tables créées.');

  // ── Admin ──
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@fozila.com';
  const adminPwd   = process.env.ADMIN_PASSWORD || 'AdminFozila@2024';
  const adminName  = process.env.ADMIN_NAME || 'Administrateur';
  const hash = bcrypt.hashSync(adminPwd, 12);

  db.run(
    `INSERT OR IGNORE INTO users (name, email, password, is_admin) VALUES (?, ?, ?, 1)`,
    [adminName, adminEmail, hash]
  );
  console.log(`👑 Admin : ${adminEmail}`);

  // ── Albums ──
  const albums = [
    ['Nuit Africaine',    'Afrobeat',   12, 2024, 2500, '🎵', 'linear-gradient(135deg,#1a0533,#4c1d95)', 'Nouveau',   1, 42],
    ['Savane Électrique', 'World',       8, 2024, 3000, '🎸', 'linear-gradient(135deg,#052e16,#166534)', '',          0, 28],
    ['Cosmos Soul',       'Electronic', 10, 2023, 2000, '🎹', 'linear-gradient(135deg,#1e1b4b,#3730a3)', '',          1, 35],
    ['Flow Rouge',        'Hip-Hop',    14, 2024, 3500, '🎤', 'linear-gradient(135deg,#450a0a,#991b1b)', 'Populaire', 0, 61],
    ['Rythme Sauvage',    'Afro-Funk',   9, 2023, 2500, '🥁', 'linear-gradient(135deg,#431407,#9a3412)', '',         0, 19],
    ['Harmonie Bleue',    'Soul',       11, 2024, 3000, '🎶', 'linear-gradient(135deg,#0c4a6e,#0369a1)', '',         0, 23],
  ];
  albums.forEach(a => db.run(
    `INSERT INTO albums (title,genre,tracks,year,price,emoji,grad,tag,featured,sales) VALUES (?,?,?,?,?,?,?,?,?,?)`, a
  ));
  console.log(`💿 ${albums.length} albums insérés.`);

  // ── Singles ──
  const singles = [
    ['Lomé Soir',      'Afrobeat',  500, '3:42', '🎤', 'linear-gradient(135deg,#1a0533,#7c3aed)', 1, 1, 87],
    ['Nuit de Kumasi', 'Highlife',  600, '5:22', '🎸', 'linear-gradient(135deg,#052e16,#166534)', 0, 1, 55],
    ['Accra Vibe',     'Afrobeat',  700, '4:10', '🎵', 'linear-gradient(135deg,#1e1b4b,#3730a3)', 1, 1, 33],
    ['Ouaga by Night', 'Afro-Funk', 500, '3:55', '🎹', 'linear-gradient(135deg,#431407,#9a3412)', 0, 0, 21],
  ];
  singles.forEach(s => db.run(
    `INSERT INTO singles (title,genre,price,duration,emoji,grad,featured,live,sales) VALUES (?,?,?,?,?,?,?,?,?)`, s
  ));
  console.log(`🎵 ${singles.length} singles insérés.`);

  // ── Annonces ──
  [
    "🎤 Concert live — Nuit Africaine · 15 Juin à Dakar",
    "🎸 Nouvel album Savane Électrique disponible",
    "🔥 Flow Rouge Festival · 5 Août à Lomé",
    "🎁 Offre spéciale : -20% sur tout le catalogue ce week-end",
  ].forEach(c => db.run(`INSERT INTO announcements (content) VALUES (?)`, [c]));
  console.log('📢 Annonces insérées.');

  save();
  console.log(`\n🚀 Base de données prête ! → ${DB_PATH}`);
  console.log(`   Admin : ${adminEmail} / mot de passe dans .env\n`);
}

init().catch(err => { console.error('❌ Erreur :', err); process.exit(1); });
