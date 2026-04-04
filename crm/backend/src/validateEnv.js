/**
 * Validação obrigatória de variáveis de ambiente no startup.
 * Deve ser chamada antes de iniciar o servidor.
 */
function validateEnv() {
  const env = process.env.NODE_ENV || 'development';
  const jwtSecret = process.env.JWT_SECRET || 'changeme';
  const databaseUrl = process.env.DATABASE_URL || '';
  const useMock = process.env.USE_MOCK !== 'false';

  console.info(`[ENV] Ambiente: ${env}`);
  console.info(`[ENV] USE_MOCK: ${useMock}`);
  console.info(`[ENV] DATABASE_URL definida: ${Boolean(databaseUrl)}`);

  const errors = [];

  if (env === 'production') {
    if (!jwtSecret || jwtSecret === 'changeme') {
      errors.push("JWT_SECRET não pode ser 'changeme' ou vazio em produção.");
    }

    if (!databaseUrl) {
      errors.push('DATABASE_URL é obrigatória em produção.');
    }

    if (useMock) {
      errors.push('USE_MOCK deve ser false em produção.');
    }
  }

  if (errors.length > 0) {
    for (const err of errors) {
      console.error(`[ENV] ERRO: ${err}`);
    }
    console.error('[ENV] Ambiente inválido para produção. Corrija as variáveis acima e reinicie.');
    process.exit(1);
  }

  console.info('[ENV] Validação de ambiente concluída com sucesso.');
}

module.exports = { validateEnv };
