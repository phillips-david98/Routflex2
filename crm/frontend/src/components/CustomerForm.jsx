import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { validateCpfCnpj, maskCpfCnpj, maskPhone, maskCep } from '../utils/validators.js';

const ESTADOS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
const DDDS = ['11','12','13','14','15','16','17','18','19','21','22','24','27','28','31','32','33','34','35','37','38','41','42','43','44','45','46','47','48','49','51','53','54','55','61','62','63','64','65','66','67','68','69','71','73','74','75','77','79','81','82','83','84','85','86','87','88','89','91','92','93','94','95','96','97','98','99'];
const STATUS_OPTS = [
  { value: 'ATIVO',                label: 'Ativo' },
  { value: 'INATIVO',              label: 'Inativo' },
  { value: 'SEM_COORDENADA',       label: 'Sem Coordenada' },
  { value: 'PENDENTE_INTEGRACAO',  label: 'Pendente Integração' },
];

const EMPTY = {
  name: '', phone: '', ddd: '', cpf_cnpj: '',
  address: '', number: '', neighborhood: '', city: '', state: '', zip_code: '',
  lat: '', lon: '', status: 'ATIVO', notes: '',
};

export default function CustomerForm({ open, onClose, onSave, initialData }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initialData ? { ...EMPTY, ...initialData, lat: initialData.lat ?? '', lon: initialData.lon ?? '' } : EMPTY);
      setErrors({});
    }
  }, [open, initialData]);

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));
  const setErr = (field, msg) => setErrors(e => ({ ...e, [field]: msg }));
  const clearErr = (field) => setErrors(e => { const n = { ...e }; delete n[field]; return n; });

  const handleChange = (e) => {
    let { name, value } = e.target;
    if (name === 'cpf_cnpj') value = maskCpfCnpj(value);
    if (name === 'phone') value = maskPhone(value);
    if (name === 'zip_code') value = maskCep(value);
    set(name, value);
    clearErr(name);
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim() || form.name.trim().length < 2) errs.name = 'Nome é obrigatório (mín. 2 caracteres).';
    if (form.cpf_cnpj) {
      const r = validateCpfCnpj(form.cpf_cnpj);
      if (!r.valid) errs.cpf_cnpj = r.message;
    }
    if (form.lat && isNaN(parseFloat(form.lat))) errs.lat = 'Latitude inválida.';
    if (form.lon && isNaN(parseFloat(form.lon))) errs.lon = 'Longitude inválida.';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      await onSave({
        ...form,
        lat: form.lat !== '' ? parseFloat(form.lat) : null,
        lon: form.lon !== '' ? parseFloat(form.lon) : null,
      });
      onClose();
    } catch (err) {
      const msg = err?.response?.data?.error || 'Erro ao salvar cliente.';
      setErrors({ _global: msg });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const isEdit = Boolean(initialData?.id);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{isEdit ? 'Editar Cliente' : 'Novo Cliente'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {errors._global && (
              <div className="alert-item error" style={{ marginTop: 0 }}>
                {errors._global}
              </div>
            )}

            {/* Seção: Identificação */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>
                Identificação
              </div>
              <div className="grid-2">
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Nome / Razão Social *</label>
                  <input name="name" className={`form-control${errors.name ? ' error' : ''}`} value={form.name} onChange={handleChange} placeholder="Ex: Distribuidora ABC Ltda" />
                  {errors.name && <span className="form-error">{errors.name}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">CPF / CNPJ</label>
                  <input name="cpf_cnpj" className={`form-control${errors.cpf_cnpj ? ' error' : ''}`} value={form.cpf_cnpj} onChange={handleChange} placeholder="000.000.000-00 ou 00.000.000/0001-00" />
                  {errors.cpf_cnpj && <span className="form-error">{errors.cpf_cnpj}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select name="status" className="form-control" value={form.status} onChange={handleChange}>
                    {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Seção: Contato */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>
                Contato
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">DDD</label>
                  <select name="ddd" className="form-control" value={form.ddd} onChange={handleChange}>
                    <option value="">Selecione</option>
                    {DDDS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Telefone</label>
                  <input name="phone" className="form-control" value={form.phone} onChange={handleChange} placeholder="(00) 00000-0000" />
                </div>
              </div>
            </div>

            {/* Seção: Endereço */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>
                Endereço
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="grid-2">
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Logradouro</label>
                    <input name="address" className="form-control" value={form.address} onChange={handleChange} placeholder="Av. Paulista" />
                  </div>
                </div>
                <div className="grid-3">
                  <div className="form-group">
                    <label className="form-label">Número</label>
                    <input name="number" className="form-control" value={form.number} onChange={handleChange} placeholder="1000" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bairro</label>
                    <input name="neighborhood" className="form-control" value={form.neighborhood} onChange={handleChange} placeholder="Bela Vista" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">CEP</label>
                    <input name="zip_code" className="form-control" value={form.zip_code} onChange={handleChange} placeholder="00000-000" />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Cidade</label>
                    <input name="city" className="form-control" value={form.city} onChange={handleChange} placeholder="São Paulo" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Estado</label>
                    <select name="state" className="form-control" value={form.state} onChange={handleChange}>
                      <option value="">Selecione</option>
                      {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Seção: Coordenadas */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>
                Coordenadas Geográficas
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Latitude</label>
                  <input name="lat" className={`form-control${errors.lat ? ' error' : ''}`} value={form.lat} onChange={handleChange} placeholder="-23.5613" type="text" />
                  {errors.lat && <span className="form-error">{errors.lat}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Longitude</label>
                  <input name="lon" className={`form-control${errors.lon ? ' error' : ''}`} value={form.lon} onChange={handleChange} placeholder="-46.6558" type="text" />
                  {errors.lon && <span className="form-error">{errors.lon}</span>}
                </div>
              </div>
              {(!form.lat || !form.lon) && (
                <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 6, display: 'flex', gap: 5, alignItems: 'center' }}>
                  ⚠ Sem coordenadas → status será definido como "Sem Coordenada" automaticamente.
                </div>
              )}
            </div>

            {/* Observações */}
            <div className="form-group">
              <label className="form-label">Observações</label>
              <textarea name="notes" className="form-control" rows={2} value={form.notes} onChange={handleChange} placeholder="Informações adicionais..." style={{ resize: 'vertical' }} />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Salvando…</> : (isEdit ? 'Salvar alterações' : 'Cadastrar cliente')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
