import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema.js';
import * as dotenv from 'dotenv';

dotenv.config();

const client = createClient({
  url: process.env.DB_URL || 'file:local.db',
  authToken: process.env.DB_AUTH_TOKEN || '',
});

/** Ensures `app_settings` exists and migrates legacy column `key` → `setting_key`. */
export async function ensureAuxiliarySchema(): Promise<void> {
  try {
    await client.execute('DROP INDEX IF EXISTS app_settings_key_unique');
  } catch {
    /* ignore */
  }
  try {
    await client.execute('ALTER TABLE app_settings RENAME COLUMN key TO setting_key');
  } catch {
    /* no table, or already setting_key */
  }
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        setting_key text NOT NULL,
        value text NOT NULL
      )
    `);
  } catch (e) {
    console.error('ensureAuxiliarySchema CREATE app_settings:', e);
  }
  try {
    await client.execute(
      'CREATE UNIQUE INDEX IF NOT EXISTS app_settings_setting_key_unique ON app_settings (setting_key)'
    );
  } catch {
    /* ignore */
  }

  // Migration 0004 may not have run locally / on Turso — Drizzle expects these columns.
  try {
    await client.execute('ALTER TABLE clients ADD COLUMN archived integer DEFAULT 0');
  } catch {
    /* duplicate column */
  }
  try {
    await client.execute('ALTER TABLE sales_invoices ADD COLUMN archived integer DEFAULT 0');
  } catch {
    /* duplicate column */
  }
  try {
    await client.execute('ALTER TABLE clients ADD COLUMN completed integer DEFAULT 0');
  } catch {
    /* duplicate column */
  }
  try {
    await client.execute('ALTER TABLE sales_invoices ADD COLUMN completed integer DEFAULT 0');
  } catch {
    /* duplicate column */
  }

  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        user_id integer,
        action text NOT NULL,
        entity_type text NOT NULL,
        entity_id integer,
        details text,
        created_at integer,
        FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE no action
      )
    `);
  } catch (e) {
    console.error('ensureAuxiliarySchema activity_logs:', e);
  }

  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS reminders (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        user_id integer NOT NULL REFERENCES users(id),
        title text NOT NULL,
        note text,
        due_date text NOT NULL,
        completed integer DEFAULT 0,
        created_at integer
      )
    `);
  } catch (e) {
    console.error('ensureAuxiliarySchema reminders:', e);
  }

  try {
    await client.execute(
      `ALTER TABLE reminders ADD COLUMN client_id integer REFERENCES clients(id)`
    );
  } catch {
    /* colonne déjà présente */
  }

  try {
    await client.execute(
      `ALTER TABLE reminders ADD COLUMN cheque_id integer REFERENCES cheque_registry(id)`
    );
  } catch {
    /* colonne déjà présente */
  }

  try {
    await client.execute(`ALTER TABLE cheque_registry ADD COLUMN archived integer DEFAULT 0`);
  } catch {
    /* colonne déjà présente */
  }

  try {
    await client.execute(`ALTER TABLE delivery_notes ADD COLUMN archived integer DEFAULT 0`);
  } catch {
    /* colonne déjà présente */
  }
  try {
    await client.execute(`ALTER TABLE delivery_notes ADD COLUMN completed integer DEFAULT 0`);
  } catch {
    /* colonne déjà présente */
  }
}

export const db = drizzle(client, { schema });
