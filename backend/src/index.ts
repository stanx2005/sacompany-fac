import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import clientRoutes from './routes/clientRoutes';
import supplierRoutes from './routes/supplierRoutes';
import productRoutes from './routes/productRoutes';
import tabRoutes from './routes/tabRoutes';
import chequeRoutes from './routes/chequeRoutes';
import invoiceRoutes from './routes/invoiceRoutes';
import deliveryNoteRoutes from './routes/deliveryNoteRoutes';
import purchaseOrderRoutes from './routes/purchaseOrderRoutes';
import quoteRoutes from './routes/quoteRoutes';
import statsRoutes from './routes/statsRoutes';

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
