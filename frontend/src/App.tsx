import React from 'react';
import { useAuthStore } from './store/authStore';
import { Navigate, Routes, Route, Link } from 'react-router-dom';
import Layout from './components/Layout';
import Clients from './pages/Clients';
import Suppliers from './pages/Suppliers';
import Products from './pages/Products';
import PurchaseProducts from './pages/PurchaseProducts';
import Tabs from './pages/Tabs';
import Cheques from './pages/Cheques';
import CashPayments from './pages/CashPayments';
import Invoices from './pages/Invoices';
import Dashboard from './pages/Dashboard';
import DeliveryNotes from './pages/DeliveryNotes';
import PurchaseOrders from './pages/PurchaseOrders';
import PurchaseInvoices from './pages/PurchaseInvoices';

import Quotes from './pages/Quotes';
import Profile from './pages/Profile';
import SettingsPage from './pages/Settings';
import ActivityLog from './pages/ActivityLog';
import Reminders from './pages/Reminders';

function App() {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/products" element={<Products />} />
        <Route path="/purchase-products" element={<PurchaseProducts />} />
        <Route path="/quotes" element={<Quotes />} />
        <Route path="/purchase-orders" element={<PurchaseOrders />} />
        <Route path="/purchase-invoices" element={<PurchaseInvoices />} />
        <Route path="/delivery-notes" element={<DeliveryNotes />} />
        <Route path="/tabs" element={<Tabs />} />
        <Route path="/cheques" element={<Cheques />} />
        <Route path="/cash-payments" element={<CashPayments />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/activity" element={<ActivityLog />} />
        <Route path="/reminders" element={<Reminders />} />
        <Route path="*" element={
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <h2 className="text-2xl font-bold text-gray-800">Page non trouvée</h2>
            <Link to="/" className="text-blue-600 hover:underline">Retour au tableau de bord</Link>
          </div>
        } />
      </Routes>
    </Layout>
  );
}

export default App;
