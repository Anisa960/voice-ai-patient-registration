const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { validatePatient } = require('../validation');

const router = express.Router();

const ok = (data, status = 200) => ({ status, body: { data, error: null } });
const fail = (error, status = 400) => ({ status, body: { data: null, error } });

const now = () => new Date().toISOString();

// ---- GET /patients ---- list with optional filters
router.get('/', (req, res) => {
  try {
    const { last_name, date_of_birth, phone_number } = req.query;
    let query = 'SELECT * FROM patients WHERE deleted_at IS NULL';
    const params = [];

    if (last_name) {
      query += ' AND last_name = ?';
      params.push(last_name);
    }
    if (date_of_birth) {
      query += ' AND date_of_birth = ?';
      params.push(date_of_birth);
    }
    if (phone_number) {
      query += ' AND phone_number = ?';
      params.push(phone_number.replace(/[\s\-().]/g, ''));
    }

    const rows = db.prepare(query).all(...params);
    const { status, body } = ok(rows);
    res.status(status).json(body);
  } catch (err) {
    console.error('GET /patients error:', err);
    const { status, body } = fail('Internal server error', 500);
    res.status(status).json(body);
  }
});

// ---- GET /patients/:id ----
router.get('/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM patients WHERE patient_id = ? AND deleted_at IS NULL').get(req.params.id);
    if (!row) {
      const { status, body } = fail('Patient not found', 404);
      return res.status(status).json(body);
    }
    const { status, body } = ok(row);
    res.status(status).json(body);
  } catch (err) {
    console.error('GET /patients/:id error:', err);
    const { status, body } = fail('Internal server error', 500);
    res.status(status).json(body);
  }
});

// ---- POST /patients ---- create
router.post('/', (req, res) => {
  try {
    const errors = validatePatient(req.body, false);
    if (errors.length) {
      const { status, body } = fail(errors, 422);
      return res.status(status).json(body);
    }

    const patient_id = uuidv4();
    const timestamp = now();
    const p = { ...req.body, patient_id, created_at: timestamp, updated_at: timestamp };

    db.prepareNamed(`
      INSERT INTO patients (
        patient_id, first_name, last_name, date_of_birth, sex, phone_number, email,
        address_line_1, address_line_2, city, state, zip_code,
        insurance_provider, insurance_member_id, preferred_language,
        emergency_contact_name, emergency_contact_phone, created_at, updated_at
      ) VALUES (
        @patient_id, @first_name, @last_name, @date_of_birth, @sex, @phone_number, @email,
        @address_line_1, @address_line_2, @city, @state, @zip_code,
        @insurance_provider, @insurance_member_id, @preferred_language,
        @emergency_contact_name, @emergency_contact_phone, @created_at, @updated_at
      )
    `).run({
      preferred_language: 'English',
      email: null, address_line_2: null, insurance_provider: null,
      insurance_member_id: null, emergency_contact_name: null, emergency_contact_phone: null,
      ...p,
    });

    // Observability requirement: log the final collected payload.
    console.log('[PATIENT CREATED]', JSON.stringify({ patient_id, timestamp }));

    const created = db.prepare('SELECT * FROM patients WHERE patient_id = ?').get(patient_id);
    const { status, body } = ok(created, 201);
    res.status(status).json(body);
  } catch (err) {
    console.error('POST /patients error:', err);
    const { status, body } = fail('Internal server error', 500);
    res.status(status).json(body);
  }
});

// ---- PUT /patients/:id ---- partial update
router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM patients WHERE patient_id = ? AND deleted_at IS NULL').get(req.params.id);
    if (!existing) {
      const { status, body } = fail('Patient not found', 404);
      return res.status(status).json(body);
    }

    const errors = validatePatient(req.body, true);
    if (errors.length) {
      const { status, body } = fail(errors, 422);
      return res.status(status).json(body);
    }

    const updatable = [
      'first_name', 'last_name', 'date_of_birth', 'sex', 'phone_number', 'email',
      'address_line_1', 'address_line_2', 'city', 'state', 'zip_code',
      'insurance_provider', 'insurance_member_id', 'preferred_language',
      'emergency_contact_name', 'emergency_contact_phone',
    ];

    const fields = updatable.filter((f) => req.body[f] !== undefined);
    if (fields.length === 0) {
      const { status, body } = fail('No updatable fields provided', 400);
      return res.status(status).json(body);
    }

    const setClause = fields.map((f) => `${f} = @${f}`).join(', ');
    const params = { patient_id: req.params.id, updated_at: now() };
    for (const f of fields) params[f] = req.body[f];

    db.prepareNamed(`UPDATE patients SET ${setClause}, updated_at = @updated_at WHERE patient_id = @patient_id`).run(params);

    console.log('[PATIENT UPDATED]', JSON.stringify({ patient_id: req.params.id, fields }));

    const updated = db.prepare('SELECT * FROM patients WHERE patient_id = ?').get(req.params.id);
    const { status, body } = ok(updated);
    res.status(status).json(body);
  } catch (err) {
    console.error('PUT /patients/:id error:', err);
    const { status, body } = fail('Internal server error', 500);
    res.status(status).json(body);
  }
});

// ---- DELETE /patients/:id ---- soft delete
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM patients WHERE patient_id = ? AND deleted_at IS NULL').get(req.params.id);
    if (!existing) {
      const { status, body } = fail('Patient not found', 404);
      return res.status(status).json(body);
    }
    db.prepare('UPDATE patients SET deleted_at = ? WHERE patient_id = ?').run(now(), req.params.id);
    console.log('[PATIENT SOFT-DELETED]', JSON.stringify({ patient_id: req.params.id }));
    const { status, body } = ok({ patient_id: req.params.id, deleted: true });
    res.status(status).json(body);
  } catch (err) {
    console.error('DELETE /patients/:id error:', err);
    const { status, body } = fail('Internal server error', 500);
    res.status(status).json(body);
  }
});

module.exports = router;
