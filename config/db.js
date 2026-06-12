// ══════════════════════════════════════════════════
//  FOZILA — Connexion SQLite via sql.js (pur JS)
//  Aucune compilation native requise
// ══════════════════════════════════════════════════

require('dotenv').config();
const path = require('path');
const fs   = require('fs');

const DB_PATH = process.env.DB_PATH || './db/fozila.db';
const dbDir   = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const initSqlJs = require('sql.js');

let db = null;

// Charger ou créer la base de données
async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Activer les clés étrangères
  db.run('PRAGMA foreign_keys = ON;');

  // Créer la table tracks si elle n'existe pas encore
  db.run(`CREATE TABLE IF NOT EXISTS tracks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    album_id   INTEGER NOT NULL,
    title      TEXT    NOT NULL DEFAULT 'Titre',
    track_num  INTEGER NOT NULL DEFAULT 1,
    file_path  TEXT    NOT NULL DEFAULT '',
    duration   TEXT    DEFAULT '',
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  )`);
  saveDb();

  return db;
}

// Sauvegarder la DB sur disque après chaque écriture
function saveDb() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// Exécuter une requête sans retour (INSERT, UPDATE, DELETE, CREATE)
function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

// Récupérer une seule ligne
function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

// Récupérer toutes les lignes
function all(sql, params = []) {
  const stmt   = db.prepare(sql);
  const rows   = [];
  stmt.bind(params);
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Récupérer le dernier ID inséré
function lastInsertRowid() {
  const row = get('SELECT last_insert_rowid() as id');
  return row ? row.id : null;
}

module.exports = { getDb, saveDb, run, get, all, lastInsertRowid };
