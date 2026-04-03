import { db } from '../db/index.js';
import { appSettings, salesInvoices } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const CONFIG_KEY = 'main_config';

export type NumberingConfig = {
  invoice: string;
  invoiceTab: string;
  invoiceDevis: string;
  invoiceConv: string;
  bl: string;
  blConv: string;
  bc: string;
  bcConv: string;
  quote: string;
  cash: string;
  /** Préfixe pour le PDF « Bon » généré depuis le carnet (suffixe client + horodatage court). */
  bonTab: string;
};

export type PdfBrandingConfig = {
  footerLegal: string;
  logoDataUrl: string;
};

export type MainAppConfig = {
  numbering: NumberingConfig;
  pdfBranding: PdfBrandingConfig;
};

const DEFAULT_CONFIG: MainAppConfig = {
  numbering: {
    invoice: 'FACT-',
    invoiceTab: 'FACT-TAB-',
    invoiceDevis: 'FACT-DEV-',
    invoiceConv: 'FACT-CONV-',
    bl: 'BL-',
    blConv: 'BL-CONV-',
    bc: 'BC-',
    bcConv: 'BC-CONV-',
    quote: 'DEV-',
    cash: 'CASH-',
    bonTab: 'BON-TAB-',
  },
  pdfBranding: {
    footerLegal: '',
    logoDataUrl: '',
  },
};

let cache: MainAppConfig | null = null;

const SEQUENTIAL_INVOICE_PREFIX_KEYS: (keyof NumberingConfig)[] = [
  'invoice',
  'invoiceTab',
  'invoiceDevis',
  'invoiceConv',
];

/**
 * Préfixe seul (ex. FACT-), sans numéro ni date. Si Paramètres contient par erreur
 * « FACT-001-2026 », on ramène à « FACT- » sinon le prochain numéro devient FACT-001-2026001.
 */
export function normalizeSequentialNumberingPrefix(prefix: string): string {
  const p = String(prefix || '').trim();
  const m = p.match(/^([A-Za-z]+-)(\d)/);
  if (m?.[1]) return m[1];
  return p;
}

function mergeWithDefaults(raw: Partial<MainAppConfig> | null): MainAppConfig {
  if (!raw) return structuredClone(DEFAULT_CONFIG);
  const numbering = { ...DEFAULT_CONFIG.numbering, ...raw.numbering };
  for (const k of SEQUENTIAL_INVOICE_PREFIX_KEYS) {
    numbering[k] = normalizeSequentialNumberingPrefix(String(numbering[k] ?? ''));
  }
  return {
    numbering,
    pdfBranding: { ...DEFAULT_CONFIG.pdfBranding, ...raw.pdfBranding },
  };
}

export function invalidateConfigCache() {
  cache = null;
}

export async function getMainConfig(): Promise<MainAppConfig> {
  if (cache) return cache;
  const rows = await db.select().from(appSettings).where(eq(appSettings.settingKey, CONFIG_KEY)).limit(1);
  const row = rows[0];
  if (!row?.value) {
    cache = structuredClone(DEFAULT_CONFIG);
    return cache;
  }
  try {
    const parsed = JSON.parse(row.value) as Partial<MainAppConfig>;
    cache = mergeWithDefaults(parsed);
    return cache;
  } catch {
    cache = structuredClone(DEFAULT_CONFIG);
    return cache;
  }
}

export async function saveMainConfig(config: MainAppConfig): Promise<void> {
  const merged = mergeWithDefaults(config);
  const existingRows = await db.select().from(appSettings).where(eq(appSettings.settingKey, CONFIG_KEY)).limit(1);
  const existing = existingRows[0];
  if (existing) {
    await db
      .update(appSettings)
      .set({ value: JSON.stringify(merged) })
      .where(eq(appSettings.id, existing.id));
  } else {
    await db.insert(appSettings).values({ settingKey: CONFIG_KEY, value: JSON.stringify(merged) });
  }
  cache = merged;
}

/** Numéro affiché : 0 pour le premier enregistrement (id SQLite = 1). */
export function docNumber(prefix: string, recordId: number): string {
  const n = Math.max(0, Math.floor(Number(recordId)) - 1);
  return `${prefix}${n}`;
}

/** Suffixe toujours sur 3 chiffres : FACT-001, FACT-002, FACT-003 … */
const DEFAULT_INVOICE_SEQ_MIN_DIGITS = 3;

/** Plus grand suffixe numérique déjà utilisé pour ce préfixe (ex. FACT-014 → 14, FACT-01 → 1). Ignore les brouillons TEMP-*. */
export function maxInvoiceSuffixForPrefix(prefix: string, invoiceNumbers: string[]): number {
  prefix = normalizeSequentialNumberingPrefix(prefix);
  if (!prefix) return 0;
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}(\\d+)$`);
  let max = 0;
  for (const raw of invoiceNumbers) {
    const m = raw?.match(re);
    if (m?.[1]) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n)) max = Math.max(max, n);
    }
  }
  return max;
}

function formatInvoiceSequentialPart(n: number, minDigits: number): string {
  const s = String(n);
  return s.length < minDigits ? s.padStart(minDigits, '0') : s;
}

/**
 * Prochain numéro de facture pour ce préfixe : FACT-001, FACT-002… indépendamment de l'id SQLite.
 * Chaque préfixe (FACT-, FACT-TAB-, etc.) a sa propre suite.
 */
export async function allocateNextSequentialInvoiceNumber(
  prefix: string,
  minDigits: number = DEFAULT_INVOICE_SEQ_MIN_DIGITS
): Promise<string> {
  const base = normalizeSequentialNumberingPrefix(prefix);
  const rows = await db.select({ invoiceNumber: salesInvoices.invoiceNumber }).from(salesInvoices);
  const nums = rows.map((r) => r.invoiceNumber ?? '');
  const next = maxInvoiceSuffixForPrefix(base, nums) + 1;
  return `${base}${formatInvoiceSequentialPart(next, minDigits)}`;
}

function isUniqueConstraintError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /UNIQUE|unique constraint|SQLITE_CONSTRAINT_UNIQUE/i.test(msg);
}

/**
 * Assigne un numéro séquentiel à une ligne facture déjà créée (TEMP-…), avec retry si collision rare.
 */
export async function assignSequentialInvoiceNumberToRow(
  invoiceId: number,
  prefix: string,
  minDigits: number = DEFAULT_INVOICE_SEQ_MIN_DIGITS
): Promise<string> {
  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const invoiceNumber = await allocateNextSequentialInvoiceNumber(prefix, minDigits);
    try {
      await db.update(salesInvoices).set({ invoiceNumber }).where(eq(salesInvoices.id, invoiceId));
      return invoiceNumber;
    } catch (e) {
      if (isUniqueConstraintError(e) && attempt < maxAttempts - 1) continue;
      throw e;
    }
  }
  throw new Error('Impossible d\'attribuer un numéro de facture unique.');
}
