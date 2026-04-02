import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import productRoutes from './routes/productRoutes.js';
import tabRoutes from './routes/tabRoutes.js';
import chequeRoutes from './routes/chequeRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import deliveryNoteRoutes from './routes/deliveryNoteRoutes.js';
import purchaseOrderRoutes from './routes/purchaseOrderRoutes.js';
import statsRoutes from './routes/statsRoutes.js';
import quoteRoutes from './routes/quoteRoutes.js';
import cashPaymentRoutes from './routes/cashPaymentRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import notificationsRoutes from './routes/notificationsRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import reminderRoutes from './routes/reminderRoutes.js';
import messagingRoutes from './routes/messagingRoutes.js';
import { ensureAuxiliarySchema } from './db/index.js';

dotenv.config();

await ensureAuxiliarySchema();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
// Default 100kb is too small for settings JSON with base64 logo
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/products', productRoutes);
app.use('/api/tabs', tabRoutes);
app.use('/api/cheques', chequeRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/delivery-notes', deliveryNoteRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/cash-payments', cashPaymentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/messaging', messagingRoutes);

app.get('/', (req, res) => {
  res.send('B2B Invoicing API is running...');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
