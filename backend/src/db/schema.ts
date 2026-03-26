import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  role: text('role', { enum: ['admin', 'staff'] }).default('staff'),
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
