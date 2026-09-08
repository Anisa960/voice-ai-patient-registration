require('dotenv').config();
const express = require('express');
const cors = require('cors');
const patientsRouter = require('./routes/patients');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Basic request logging (Observability requirement)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

app.get('/health', (req, res) => {
  res.status(200).json({ data: { status: 'ok' }, error: null });
});

app.use('/patients', patientsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ data: null, error: 'Route not found' });
});

// Central error handler (catches anything unhandled)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ data: null, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Patient Registration API listening on port ${PORT}`);
});
