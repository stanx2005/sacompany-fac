import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  role: text('role', { enum: ['admin', 'staff', 'accountant'] }).default('staff'),
  // Company Info for PDF
  companyName: text('company_name').default('SA COMPANY'),
  companyICE: text('company_ice').default('000000000000000'),
  companyAddress: text('company_address').default('Votre Adresse Ici, Casablanca'),
  companyEmail: text('company_email').default('contact@sacompany.ma'),
  companyPhone: text('company_phone').default('+212 5XX XX XX XX'),
  companyRIB: text('company_rib').default('000 000 0000000000000000 00'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date()),
});

export const clients = sqliteTable('clients', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  taxNumber: text('tax_number'), // Matricule Fiscale
  archived: integer('archived').default(0),
  /** Marqué « terminé » — requis avant suppression (sécurité). */
  completed: integer('completed').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date()),
});

export const suppliers = sqliteTable('suppliers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  taxNumber: text('tax_number'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date()),
});

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  price: real('price').notNull(),
  taxRate: real('tax_rate').default(20.00), // TVA 20% par défaut
  stock: integer('stock').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date()),
});

export const deliveryNotes = sqliteTable('delivery_notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  noteNumber: text('note_number').notNull().unique(),
  clientId: integer('client_id').references(() => clients.id),
  date: text('date').notNull(),
  totalInclTax: real('total_incl_tax').notNull(),
  status: text('status', { enum: ['pending', 'delivered', 'invoiced', 'cancelled'] }).default('pending'),
  archived: integer('archived').default(0),
  /** Marqué « terminé » — requis avant suppression (admin). */
  completed: integer('completed').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date()),
});

export const deliveryNoteItems = sqliteTable('delivery_note_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  deliveryNoteId: integer('delivery_note_id').references(() => deliveryNotes.id),
  productId: integer('product_id').references(() => products.id),
  quantity: integer('quantity').notNull(),
  unitPrice: real('unit_price').notNull(),
  taxRate: real('tax_rate').notNull(),
  totalLine: real('total_line').notNull(),
});

export const salesInvoices = sqliteTable('sales_invoices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  invoiceNumber: text('invoice_number').notNull().unique(),
  clientId: integer('client_id').references(() => clients.id),
  date: text('date').notNull(),
  totalExclTax: real('total_excl_tax').notNull(),
  totalTax: real('total_tax').notNull(),
  totalInclTax: real('total_incl_tax').notNull(),
  status: text('status', { enum: ['pending', 'paid', 'cancelled'] }).default('pending'),
  archived: integer('archived').default(0),
  /** Marqué « terminé » — requis avant suppression. */
  completed: integer('completed').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date()),
});

export const invoiceItems = sqliteTable('invoice_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  invoiceId: integer('invoice_id').references(() => salesInvoices.id),
  productId: integer('product_id').references(() => products.id),
  quantity: integer('quantity').notNull(),
  unitPrice: real('unit_price').notNull(),
  taxRate: real('tax_rate').notNull(),
  totalLine: real('total_line').notNull(),
  date: text('date'), // Added date field for items from tabs
});

export const purchaseOrders = sqliteTable('purchase_orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderNumber: text('order_number').notNull().unique(),
  supplierId: integer('supplier_id').references(() => suppliers.id),
  date: text('date').notNull(),
  totalInclTax: real('total_incl_tax').notNull(),
  status: text('status', { enum: ['pending', 'received', 'cancelled'] }).default('pending'),
  archived: integer('archived').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date()),
});

export const purchaseOrderItems = sqliteTable('purchase_order_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  purchaseOrderId: integer('purchase_order_id').references(() => purchaseOrders.id),
  productId: integer('product_id').references(() => products.id),
  quantity: integer('quantity').notNull(),
  unitPrice: real('unit_price').notNull(),
  taxRate: real('tax_rate').notNull(),
  totalLine: real('total_line').notNull(),
});

/** Factures fournisseur (achat) — saisie manuelle ou pièce jointe PDF / image. */
export const purchaseInvoices = sqliteTable('purchase_invoices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  supplierId: integer('supplier_id').references(() => suppliers.id),
  purchaseOrderId: integer('purchase_order_id').references(() => purchaseOrders.id),
  invoiceNumber: text('invoice_number').notNull(),
  date: text('date').notNull(),
  totalExclTax: real('total_excl_tax').notNull().default(0),
  totalTax: real('total_tax').notNull().default(0),
  totalInclTax: real('total_incl_tax').notNull().default(0),
  sourceType: text('source_type').notNull(),
  filePath: text('file_path'),
  fileMime: text('file_mime'),
  originalFilename: text('original_filename'),
  notes: text('notes'),
  status: text('status').default('pending'),
  archived: integer('archived').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date()),
});

export const purchaseInvoiceItems = sqliteTable('purchase_invoice_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  purchaseInvoiceId: integer('purchase_invoice_id').references(() => purchaseInvoices.id),
  productId: integer('product_id').references(() => products.id),
  quantity: integer('quantity').notNull(),
  unitPrice: real('unit_price').notNull(),
  taxRate: real('tax_rate').notNull(),
  totalLine: real('total_line').notNull(),
});

export const chequeRegistry = sqliteTable('cheque_registry', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  chequeNumber: text('cheque_number').notNull(),
  bankName: text('bank_name'),
  amount: real('amount').notNull(),
  issueDate: text('issue_date').notNull(),
  dueDate: text('due_date').notNull(),
  type: text('type', { enum: ['incoming', 'outgoing'] }).notNull(),
  status: text('status', { enum: ['pending', 'cleared', 'bounced'] }).default('pending'),
  isPaid: integer('is_paid').default(0), // 0 for false, 1 for true
  clientId: integer('client_id').references(() => clients.id),
  supplierId: integer('supplier_id').references(() => suppliers.id),
  invoiceId: integer('invoice_id').references(() => salesInvoices.id),
  invoiceNumber: text('invoice_number'),
  archived: integer('archived').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date()),
});

export const cashPayments = sqliteTable('cash_payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  paymentNumber: text('payment_number').notNull().unique(),
  invoiceId: integer('invoice_id').references(() => salesInvoices.id),
  clientId: integer('client_id').references(() => clients.id),
  amount: real('amount').notNull(),
  paymentDate: text('payment_date').notNull(),
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date()),
});

export const openTabs = sqliteTable('open_tabs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clientId: integer('client_id').references(() => clients.id),
  productId: integer('product_id').references(() => products.id),
  quantity: integer('quantity').notNull(),
  date: text('date').notNull(),
  isClosed: integer('is_closed').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date()),
});

export const quotes = sqliteTable('quotes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  quoteNumber: text('quote_number').notNull().unique(),
  clientId: integer('client_id').references(() => clients.id),
  date: text('date').notNull(),
  totalExclTax: real('total_excl_tax').notNull(),
  totalTax: real('total_tax').notNull(),
  totalInclTax: real('total_incl_tax').notNull(),
  status: text('status', { enum: ['pending', 'accepted', 'rejected', 'invoiced'] }).default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date()),
});

export const quoteItems = sqliteTable('quote_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  quoteId: integer('quote_id').references(() => quotes.id),
  productId: integer('product_id').references(() => products.id),
  quantity: integer('quantity').notNull(),
  unitPrice: real('unit_price').notNull(),
  taxRate: real('tax_rate').notNull(),
  totalLine: real('total_line').notNull(),
});

export const activityLogs = sqliteTable('activity_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: integer('entity_id'),
  details: text('details'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date()),
});

export const appSettings = sqliteTable('app_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** Avoid SQL column name `key` (reserved / driver quirks with libsql). */
  settingKey: text('setting_key').notNull().unique(),
  value: text('value').notNull(),
});

/** Rappels personnels (par utilisateur). */
export const reminders = sqliteTable('reminders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  /** Client lié (optionnel) — pour envoyer un rappel par e-mail / WhatsApp. */
  clientId: integer('client_id').references(() => clients.id),
  /** Chèque lié (optionnel) — suivi du numéro, montant, échéance, etc. */
  chequeId: integer('cheque_id').references(() => chequeRegistry.id),
  title: text('title').notNull(),
  note: text('note'),
  dueDate: text('due_date').notNull(),
  completed: integer('completed').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date()),
});
