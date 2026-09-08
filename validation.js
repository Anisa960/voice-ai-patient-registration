const VALID_SEX = ['Male', 'Female', 'Other', 'Decline to Answer'];
const US_STATE_ABBR = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA',
  'ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK',
  'OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
]);

function isValidDateOfBirth(dob) {
  // Expects ISO YYYY-MM-DD. Rejects invalid dates and future dates.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false;
  const d = new Date(dob + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() <= Date.now();
}

function isValidPhone(phone) {
  return /^\d{10}$/.test((phone || '').replace(/[\s\-().]/g, ''));
}

function isValidEmail(email) {
  if (!email) return true; // optional field
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidZip(zip) {
  return /^\d{5}(-\d{4})?$/.test(zip || '');
}

function isValidName(name) {
  return typeof name === 'string' && /^[A-Za-z\-' ]{1,50}$/.test(name);
}

/**
 * Validates a patient payload.
 * @param {object} body - incoming request body
 * @param {boolean} partial - if true (PUT), only validates fields that are present
 * @returns {string[]} array of human-readable error messages (empty = valid)
 */
function validatePatient(body, partial = false) {
  const errors = [];
  const required = [
    'first_name', 'last_name', 'date_of_birth', 'sex', 'phone_number',
    'address_line_1', 'city', 'state', 'zip_code',
  ];

  if (!partial) {
    for (const field of required) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        errors.push(`${field} is required`);
      }
    }
  }

  const check = (field, fn, message) => {
    if (body[field] !== undefined && body[field] !== null && !fn(body[field])) {
      errors.push(message);
    }
  };

  check('first_name', isValidName, 'first_name must be 1-50 alphabetic characters (hyphens/apostrophes allowed)');
  check('last_name', isValidName, 'last_name must be 1-50 alphabetic characters (hyphens/apostrophes allowed)');
  check('date_of_birth', isValidDateOfBirth, 'date_of_birth must be a valid date (YYYY-MM-DD) and not in the future');
  check('sex', (v) => VALID_SEX.includes(v), `sex must be one of: ${VALID_SEX.join(', ')}`);
  check('phone_number', isValidPhone, 'phone_number must be a valid 10-digit U.S. phone number');
  check('email', isValidEmail, 'email must be a valid email address');
  check('city', (v) => typeof v === 'string' && v.length >= 1 && v.length <= 100, 'city must be 1-100 characters');
  check('state', (v) => US_STATE_ABBR.has(v), 'state must be a valid 2-letter U.S. state abbreviation');
  check('zip_code', isValidZip, 'zip_code must be a 5-digit or ZIP+4 U.S. format');
  check('emergency_contact_phone', (v) => !v || isValidPhone(v), 'emergency_contact_phone must be a valid 10-digit U.S. phone number');

  return errors;
}

module.exports = { validatePatient };
