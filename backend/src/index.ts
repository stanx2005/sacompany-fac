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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

app.get('/', (req, res) => {
  res.send('B2B Invoicing API is running...');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
