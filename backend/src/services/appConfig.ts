import { db } from '../db/index.js';
import { appSettings } from '../db/schema.js';
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

function mergeWithDefaults(raw: Partial<MainAppConfig> | null): MainAppConfig {
  if (!raw) return structuredClone(DEFAULT_CONFIG);
  return {
    numbering: { ...DEFAULT_CONFIG.numbering, ...raw.numbering },
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
