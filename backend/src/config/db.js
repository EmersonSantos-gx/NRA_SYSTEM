const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('error', (err) => {
  console.error('Erro inesperado no pool do PostgreSQL (Neon):', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};