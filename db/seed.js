const { v4: uuidv4 } = require('uuid');
const db = require('./database');

const now = () => new Date().toISOString();

const seedPatients = [
  {
    patient_id: uuidv4(),
    first_name: 'Jane',
    last_name: 'Doe',
    date_of_birth: '1990-04-12',
    sex: 'Female',
    phone_number: '5551234567',
    email: 'jane.doe@example.com',
    address_line_1: '123 Main St',
    address_line_2: null,
    city: 'Austin',
    state: 'TX',
    zip_code: '73301',
    insurance_provider: 'Blue Cross',
    insurance_member_id: 'BC123456',
    preferred_language: 'English',
    emergency_contact_name: 'John Doe',
    emergency_contact_phone: '5559876543',
  },
  {
    patient_id: uuidv4(),
    first_name: 'Carlos',
    last_name: 'Mendez',
    date_of_birth: '1985-11-02',
    sex: 'Male',
    phone_number: '5552223333',
    email: null,
    address_line_1: '456 Oak Ave',
    address_line_2: 'Apt 2B',
    city: 'Phoenix',
    state: 'AZ',
    zip_code: '85001',
    insurance_provider: null,
    insurance_member_id: null,
    preferred_language: 'Spanish',
    emergency_contact_name: null,
    emergency_contact_phone: null,
  },
];

const insert = db.prepareNamed(`
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
`);

db.exec('BEGIN');
try {
  for (const p of seedPatients) {
    insert.run({ ...p, created_at: now(), updated_at: now() });
  }
  db.exec('COMMIT');
  console.log(`Seeded ${seedPatients.length} patient records.`);
} catch (err) {
  db.exec('ROLLBACK');
  throw err;
}
