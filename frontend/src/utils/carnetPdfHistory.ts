const STORAGE_KEY = 'b3b_carnet_pdf_history';

export type CarnetPdfHistoryEntry = {
  id: string;
  clientId: number;
  createdAt: string;
  noteNumber: string;
  itemIds: number[];
  /** Présent pour les BON générés après cette fonctionnalité — permet voir / retélécharger. */
  pdfBase64?: string;
  pdfFilename?: string;
};

export type CarnetPdfHistoryStore = Record<string, CarnetPdfHistoryEntry[]>;

export function loadCarnetPdfHistory(): CarnetPdfHistoryStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as CarnetPdfHistoryStore;
  } catch {
    return {};
  }
}

export function saveCarnetPdfHistory(store: CarnetPdfHistoryStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function appendCarnetPdfEntry(
  store: CarnetPdfHistoryStore,
  clientId: number,
  entry: CarnetPdfHistoryEntry
): CarnetPdfHistoryStore {
  const key = String(clientId);
  const withEntry = [...(store[key] || []), entry];
  let next: CarnetPdfHistoryStore = { ...store, [key]: withEntry };
  try {
    saveCarnetPdfHistory(next);
    return next;
  } catch {
    // Souvent QuotaExceededError : le PDF base64 dépasse la limite du localStorage
    const lite: CarnetPdfHistoryEntry = { ...entry, pdfBase64: undefined, pdfFilename: undefined };
    const withLite = [...(store[key] || []), lite];
    next = { ...store, [key]: withLite };
    try {
      saveCarnetPdfHistory(next);
    } catch {
      console.warn('carnet pdf history: impossible d’enregistrer l’historique');
    }
    return next;
  }
}

export function getExportedItemIdsForClient(store: CarnetPdfHistoryStore, clientId: number): Set<number> {
  const entries = store[String(clientId)] || [];
  const ids = new Set<number>();
  for (const e of entries) {
    for (const id of e.itemIds) ids.add(id);
  }
  return ids;
}
