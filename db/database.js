const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'patients.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Schema mirrors the assessment's data model exactly.
// patient_id is a UUID (generated in application code, stored as TEXT PRIMARY KEY).
// created_at / updated_at are UTC ISO-8601 strings, auto-managed by the app layer.
// deleted_at supports soft-delete (DELETE sets this instead of removing the row).
db.exec(`
  CREATE TABLE IF NOT EXISTS patients (
    patient_id              TEXT PRIMARY KEY,
    first_name              TEXT NOT NULL,
    last_name                TEXT NOT NULL,
    date_of_birth            TEXT NOT NULL,      -- stored as YYYY-MM-DD (ISO), displayed as MM/DD/YYYY
    sex                      TEXT NOT NULL CHECK (sex IN ('Male','Female','Other','Decline to Answer')),
    phone_number              TEXT NOT NULL,
    email                     TEXT,
    address_line_1            TEXT NOT NULL,
    address_line_2            TEXT,
    city                      TEXT NOT NULL,
    state                     TEXT NOT NULL,
    zip_code                  TEXT NOT NULL,
    insurance_provider         TEXT,
    insurance_member_id        TEXT,
    preferred_language          TEXT DEFAULT 'English',
    emergency_contact_name      TEXT,
    emergency_contact_phone     TEXT,
    created_at                TEXT NOT NULL,
    updated_at                TEXT NOT NULL,
    deleted_at                TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone_number);
  CREATE INDEX IF NOT EXISTS idx_patients_last_name ON patients(last_name);
  CREATE INDEX IF NOT EXISTS idx_patients_dob ON patients(date_of_birth);
`);

/**
 * node:sqlite requires the @/$/: prefix on named-parameter object keys by
 * default (e.g. {"@field": value}). This helper prepares a statement and
 * enables "bare" named parameters so we can pass plain {field: value}
 * objects instead — matching the @field placeholders used in our SQL.
 */
function prepareNamed(sql) {
  const stmt = db.prepare(sql);
  stmt.setAllowBareNamedParameters(true);
  return stmt;
}

module.exports = db;
module.exports.prepareNamed = prepareNamed;
