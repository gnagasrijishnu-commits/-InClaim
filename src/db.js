import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';

mkdirSync('data', { recursive: true });
export const db = new DatabaseSync('data/vanta.db');
db.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, role TEXT NOT NULL CHECK(role IN ('customer','officer')),
    name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
    phone TEXT, official_licence TEXT, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), make TEXT NOT NULL,
    model TEXT NOT NULL, year INTEGER, number_plate TEXT UNIQUE NOT NULL, vin TEXT
  );
  CREATE TABLE IF NOT EXISTS policies (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), provider TEXT NOT NULL,
    policy_number TEXT UNIQUE NOT NULL, coverage_type TEXT NOT NULL, expires_on TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY, claim_number TEXT UNIQUE NOT NULL, user_id TEXT NOT NULL REFERENCES users(id),
    vehicle_id TEXT NOT NULL REFERENCES vehicles(id), policy_id TEXT NOT NULL REFERENCES policies(id),
    incident_description TEXT NOT NULL, incident_date TEXT NOT NULL, status TEXT NOT NULL,
    submitted_at TEXT, officer_id TEXT REFERENCES users(id), officer_decision TEXT,
    officer_note TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS claim_images (
    id TEXT PRIMARY KEY, claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    angle TEXT NOT NULL CHECK(angle IN ('front','back','left','right','top','damage_closeup')),
    file_path TEXT NOT NULL, sha256 TEXT NOT NULL, mime_type TEXT NOT NULL, bytes INTEGER NOT NULL,
    is_valid INTEGER, validation_note TEXT, UNIQUE(claim_id, angle)
  );
  CREATE TABLE IF NOT EXISTS analyses (
    id TEXT PRIMARY KEY, claim_id TEXT UNIQUE NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    damage_json TEXT NOT NULL, fraud_json TEXT NOT NULL, estimate_json TEXT NOT NULL,
    overall_confidence REAL NOT NULL, generated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY, claim_id TEXT REFERENCES claims(id) ON DELETE CASCADE,
    actor_id TEXT REFERENCES users(id), action TEXT NOT NULL, detail TEXT, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL, used_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL
  );
`);

export function one(sql, ...params) { return db.prepare(sql).get(...params); }
export function all(sql, ...params) { return db.prepare(sql).all(...params); }
export function run(sql, ...params) { return db.prepare(sql).run(...params); }
