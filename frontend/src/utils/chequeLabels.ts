/** Libellés français pour les valeurs techniques des chèques (API / base). */

export function translateChequeStatus(s: string | null | undefined): string {
  if (s == null || String(s).trim() === '') return '—';
  const key = String(s).toLowerCase().trim();
  const map: Record<string, string> = {
    pending: 'En attente',
    cleared: 'Encaissé',
    bounced: 'Impayé',
  };
  return map[key] ?? s;
}

export function translateChequeType(s: string | null | undefined): string {
  if (s == null || String(s).trim() === '') return '—';
  const key = String(s).toLowerCase().trim();
  if (key === 'incoming') return 'Entrant';
  if (key === 'outgoing') return 'Sortant';
  return s;
}
