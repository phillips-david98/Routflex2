// ── CPF ────────────────────────────────────────────────────────────────────────
export function validateCpf(raw) {
  const cpf = raw.replace(/\D/g, '');
  if (cpf.length !== 11) return { valid: false, message: 'CPF deve ter 11 dígitos.' };
  if (/^(\d)\1{10}$/.test(cpf)) return { valid: false, message: 'CPF inválido (dígitos repetidos).' };

  const calcDigit = (str, len) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(str[i]) * (len + 1 - i);
    const rem = (sum * 10) % 11;
    return rem >= 10 ? 0 : rem;
  };

  if (calcDigit(cpf, 9) !== parseInt(cpf[9])) return { valid: false, message: 'CPF inválido.' };
  if (calcDigit(cpf, 10) !== parseInt(cpf[10])) return { valid: false, message: 'CPF inválido.' };
  return { valid: true, message: 'CPF válido.' };
}

// ── CNPJ ───────────────────────────────────────────────────────────────────────
export function validateCnpj(raw) {
  const cnpj = raw.replace(/\D/g, '');
  if (cnpj.length !== 14) return { valid: false, message: 'CNPJ deve ter 14 dígitos.' };
  if (/^(\d)\1{13}$/.test(cnpj)) return { valid: false, message: 'CNPJ inválido (dígitos repetidos).' };

  const calcDigit = (str, weights) => {
    const sum = weights.reduce((acc, w, i) => acc + parseInt(str[i]) * w, 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };

  if (calcDigit(cnpj, [5,4,3,2,9,8,7,6,5,4,3,2]) !== parseInt(cnpj[12])) return { valid: false, message: 'CNPJ inválido.' };
  if (calcDigit(cnpj, [6,5,4,3,2,9,8,7,6,5,4,3,2]) !== parseInt(cnpj[13])) return { valid: false, message: 'CNPJ inválido.' };
  return { valid: true, message: 'CNPJ válido.' };
}

// ── Detecta tipo ───────────────────────────────────────────────────────────────
export function validateCpfCnpj(raw) {
  if (!raw) return { valid: true, message: '' };
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11) return validateCpf(raw);
  if (digits.length === 14) return validateCnpj(raw);
  return { valid: false, message: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).' };
}

// ── Máscaras ───────────────────────────────────────────────────────────────────
export function maskCpfCnpj(value) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function maskPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}

export function maskCep(value) {
  return value.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d{0,3})/, '$1-$2');
}
