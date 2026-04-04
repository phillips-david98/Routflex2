const { Pool } = require('pg');
require('dotenv').config();

const logger = Object.freeze({
  error(message) {
    console.error(message);
  },
});

let pool = null;

const getPool = () => {
  if (process.env.USE_MOCK !== 'false') return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
    });
    pool.on('error', (err) => {
      logger.error(`[DB] Erro inesperado no cliente inativo: ${err.message}`);
    });
  }
  return pool;
};

const query = async (text, params) => {
  const db = getPool();
  if (!db) throw new Error('Banco de dados não disponível no modo mock.');
  const result = await db.query(text, params);
  return result;
};

module.exports = { getPool, query };
