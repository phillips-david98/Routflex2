import { useMemo, useState } from 'react';

const INITIAL_FILTERS = {
  segment: '',
  curve: '',
  city: '',
  territory: '',
  operationType: '',
  quick: '',
};

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

export default function useRoteirizacaoFilters(items) {
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const options = useMemo(() => {
    const cities = new Set();
    const territories = new Set();
    const segments = new Set();
    const curves = new Set();
    const operationTypes = new Set();

    items.forEach((item) => {
      if (item.city) cities.add(item.city);
      if (item.territoryCurrent) territories.add(item.territoryCurrent);
      if (item.segment) segments.add(item.segment);
      if (item.curve) curves.add(item.curve);
      if (item.operationType) operationTypes.add(item.operationType);
    });

    return {
      cities: Array.from(cities).sort(),
      territories: Array.from(territories).sort(),
      segments: Array.from(segments).sort(),
      curves: Array.from(curves).sort(),
      operationTypes: Array.from(operationTypes).sort(),
    };
  }, [items]);

  const filteredItems = useMemo(() => items.filter((item) => {
    if (filters.segment && item.segment !== filters.segment) return false;
    if (filters.curve && item.curve !== filters.curve) return false;
    if (filters.city && item.city !== filters.city) return false;
    if (filters.territory && item.territoryCurrent !== filters.territory) return false;
    if (filters.operationType && item.operationType !== filters.operationType) return false;

    if (filters.quick === 'withCoordinate' && !item.hasCoordinate) return false;
    if (filters.quick === 'withoutCoordinate' && item.hasCoordinate) return false;
    if (filters.quick === 'active' && normalize(item.status) !== 'ativo') return false;
    if (filters.quick === 'inactive' && normalize(item.status) !== 'inativo') return false;

    return true;
  }), [filters, items]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setFilters(INITIAL_FILTERS);
  }

  function applyValidationFilter(filter = {}) {
    setFilters((current) => ({ ...INITIAL_FILTERS, ...current, ...filter }));
  }

  const hasFilters = Object.values(filters).some(Boolean);

  return {
    filters,
    options,
    filteredItems,
    hasFilters,
    updateFilter,
    clearFilters,
    applyValidationFilter,
  };
}
