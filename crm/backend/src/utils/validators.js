/**
 * Valida CPF brasileiro.
 * Retorna { valid: boolean, message: string }
 */
function validateCpf(raw) {
  const cpf = raw.replace(/\D/g, '');
  if (cpf.length !== 11) return { valid: false, message: 'CPF deve ter 11 dígitos.' };
  if (/^(\d)\1{10}$/.test(cpf)) return { valid: false, message: 'CPF inválido (todos os dígitos iguais).' };

  const calcDigit = (str, len) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(str[i]) * (len + 1 - i);
    const rem = (sum * 10) % 11;
    return rem === 10 || rem === 11 ? 0 : rem;
  };

  if (calcDigit(cpf, 9) !== parseInt(cpf[9])) return { valid: false, message: 'CPF inválido (dígito verificador 1).' };
  if (calcDigit(cpf, 10) !== parseInt(cpf[10])) return { valid: false, message: 'CPF inválido (dígito verificador 2).' };
  return { valid: true, message: 'CPF válido.' };
}

/**
 * Valida CNPJ brasileiro.
 * Retorna { valid: boolean, message: string }
 */
function validateCnpj(raw) {
  const cnpj = raw.replace(/\D/g, '');
  if (cnpj.length !== 14) return { valid: false, message: 'CNPJ deve ter 14 dígitos.' };
  if (/^(\d)\1{13}$/.test(cnpj)) return { valid: false, message: 'CNPJ inválido (todos os dígitos iguais).' };

  const calcDigit = (str, weights) => {
    const sum = weights.reduce((acc, w, i) => acc + parseInt(str[i]) * w, 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  if (calcDigit(cnpj, w1) !== parseInt(cnpj[12])) return { valid: false, message: 'CNPJ inválido (dígito verificador 1).' };
  if (calcDigit(cnpj, w2) !== parseInt(cnpj[13])) return { valid: false, message: 'CNPJ inválido (dígito verificador 2).' };
  return { valid: true, message: 'CNPJ válido.' };
}

/**
 * Detecta tipo (CPF/CNPJ) e valida.
 */
function validateCpfCnpj(raw) {
  if (!raw) return { valid: true, message: 'Campo não preenchido.' };
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11) return validateCpf(raw);
  if (digits.length === 14) return validateCnpj(raw);
  return { valid: false, message: 'CPF/CNPJ deve ter 11 (CPF) ou 14 (CNPJ) dígitos.' };
}

/**
 * Normaliza telefone removendo caracteres não numéricos.
 */
function sanitizePhone(phone) {
  if (!phone) return null;
  return phone.replace(/\D/g, '');
}

/**
 * Verifica se as coordenadas são válidas para o Brasil.
 */
function isValidCoordinate(lat, lon) {
  if (lat === null || lat === undefined || lon === null || lon === undefined) return false;
  if (lat === 0 && lon === 0) return false;
  // Bounding box aproximado do Brasil
  if (lat < -34.0 || lat > 5.5) return false;
  if (lon < -74.0 || lon > -28.0) return false;
  return true;
}

module.exports = { validateCpf, validateCnpj, validateCpfCnpj, sanitizePhone, isValidCoordinate };
