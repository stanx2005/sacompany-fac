import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import {
  Plus,
  FileText,
  Search,
  Download,
  X,
  Truck,
  ShoppingCart,
  Save,
  History,
  Archive,
  CheckCircle2,
  Trash2,
  Calendar,
  Edit2,
} from 'lucide-react';
import { generatePDF, generatePDFAsBase64 } from '../utils/pdfGenerator';
import { SendDocumentActions } from '../components/SendDocumentActions';
import { useAuthStore } from '../store/authStore';

interface Invoice {
  id: number;
  invoiceNumber: string;
  date: string;
  totalInclTax: number;
  status: string;
  clientId: number;
  clientName: string;
  taxNumber: string;
  address: string;
  phone: string;
  paidCash?: number;
  paidCheque?: number;
  totalPaid?: number;
  remaining?: number;
  paymentStatus?: 'unpaid' | 'partial' | 'paid';
  archived?: number;
  completed?: number;
}

type TimelineEvent = {
  kind: 'cash' | 'cheque';
  date: string;
  amount: number;
  reference: string;
  detail: string | null;
  dueDate?: string;
};

/** YYYY-MM-DD for comparison with <input type="date"> (handles ISO or date-only strings). */
function invoiceCalendarDay(dateStr: string): string {
  const s = (dateStr || '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const t = new Date(s).getTime();
  if (Number.isNaN(t)) return '';
  const d = new Date(t);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

const Invoices = () => {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const isAccountant = user?.role === 'accountant';
  const CREATE_CLIENT_OPTION = '__create_client__';
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [timelineInvoice, setTimelineInvoice] = useState<Invoice | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState<
    'date_desc' | 'date_asc' | 'status_unpaid_first' | 'status_paid_first'
  >('date_desc');
  /** Empty = all dates; otherwise filter factures to this calendar day (YYYY-MM-DD). */
  const [filterByDate, setFilterByDate] = useState('');

  const [formData, setFormData] = useState({
    clientId: '',
    date: new Date().toISOString().split('T')[0],
    items: [{ productId: '', quantity: 1, unitPrice: 0, taxRate: 20 }]
  });
  const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [newClientData, setNewClientData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    taxNumber: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const invUrl = includeArchived ? '/invoices?includeArchived=true' : '/invoices';
      const [invoicesRes, clientsRes, productsRes, suppliersRes] = await Promise.all([
        api.get(invUrl),
        api.get('/clients'),
        api.get('/products'),
        api.get('/suppliers')
      ]);
      setInvoices(invoicesRes.data);
      setClients(clientsRes.data);
      setProducts(productsRes.data);
      setSuppliers(suppliersRes.data);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [includeArchived]);

  const openTimeline = async (invoice: Invoice) => {
    try {
      const { data } = await api.get(`/invoices/${invoice.id}/payment-timeline`);
      setTimelineEvents(data.events || []);
      setTimelineInvoice(invoice);
    } catch (e) {
      console.error(e);
      alert('Impossible de charger le paiement.');
    }
  };

  const toggleArchive = async (invoice: Invoice, archived: boolean) => {
    if (isAccountant) return;
    if (!isAdmin) return;
    if (!window.confirm(archived ? 'Archiver cette facture ?' : 'Restaurer cette facture ?')) return;
    try {
      await api.patch(`/invoices/${invoice.id}/archive`, { archived });
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Erreur.');
    }
  };

  const toggleInvoiceCompleted = async (invoice: Invoice, completed: boolean) => {
    if (isAccountant) return;
    const ok = window.confirm(
      completed
        ? 'Marquer cette facture comme terminée ? Vous pourrez ensuite la supprimer (admin).'
        : 'Retirer le marquage « terminée » ?'
    );
    if (!ok) return;
    try {
      await api.patch(`/invoices/${invoice.id}/complete`, { completed });
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Erreur.');
    }
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    if (isAccountant) return;
    if (!isAdmin) return;
    if (!Number(invoice.completed || 0)) return;
    if (!window.confirm(`Supprimer définitivement la facture ${invoice.invoiceNumber} ?`)) return;
    try {
      await api.delete(`/invoices/${invoice.id}`);
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Erreur.');
    }
  };

  const handleDownloadPDF = async (invoice: Invoice) => {
    try {
      const [itemsRes, settingsRes] = await Promise.all([
        api.get(`/invoices/${invoice.id}/items`),
        api.get('/settings').catch(() => ({ data: {} })),
      ]);
      const items = itemsRes.data;
      const entity = {
        name: invoice.clientName,
        taxNumber: invoice.taxNumber,
        address: invoice.address,
        phone: invoice.phone
      };
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      const pb = settingsRes.data?.pdfBranding || {};
      generatePDF("FACTURE", invoice, items, entity, { ...u, ...pb });
    } catch (error) {
      console.error('Erreur PDF:', error);
    }
  };

  const prepareInvoicePdf = async (invoice: Invoice) => {
    const [itemsRes, settingsRes] = await Promise.all([
      api.get(`/invoices/${invoice.id}/items`),
      api.get('/settings').catch(() => ({ data: {} })),
    ]);
    const items = itemsRes.data;
    const entity = {
      name: invoice.clientName,
      taxNumber: invoice.taxNumber,
      address: invoice.address,
      phone: invoice.phone,
    };
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    const pb = settingsRes.data?.pdfBranding || {};
    return generatePDFAsBase64('FACTURE', invoice, items, entity, { ...u, ...pb });
  };

  const handleConvertToBL = async (id: number) => {
    if (isAccountant) return;
    if (window.confirm('Convertir cette facture en Bon de Livraison ?')) {
      try {
        await api.post(`/invoices/${id}/convert-bl`);
        alert('Conversion réussie ! Retrouvez le bon dans la section Bon de Livraison.');
      } catch (error) {
        console.error('Erreur conversion:', error);
      }
    }
  };

  const handleOpenConvertBC = (id: number) => {
    if (isAccountant) return;
    setSelectedInvoiceId(id);
    setIsConvertModalOpen(true);
  };

  const handleConvertToBC = async () => {
    if (isAccountant) return;
    if (!selectedSupplierId) return alert('Veuillez sélectionner un fournisseur.');
    try {
      await api.post(`/invoices/${selectedInvoiceId}/convert-bc`, { supplierId: selectedSupplierId });
      alert('Conversion réussie ! Retrouvez le bon dans la section Bon de Commande.');
      setIsConvertModalOpen(false);
      setSelectedSupplierId('');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors de la conversion.');
    }
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { productId: '', quantity: 1, unitPrice: 0, taxRate: 20 }]
    });
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    if (field === 'productId') {
      const product = products.find(p => p.id === parseInt(value));
      if (product) {
        newItems[index] = { 
          ...newItems[index], 
          productId: value, 
          unitPrice: product.price,
          taxRate: product.taxRate 
        };
      } else {
        newItems[index] = { ...newItems[index], [field]: value };
      }
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAccountant) return;
    try {
      const payload = {
        ...formData,
        clientId: parseInt(formData.clientId),
        items: formData.items.map(item => ({
          ...item,
          productId: parseInt(item.productId),
          quantity: parseInt(item.quantity.toString()),
          unitPrice: parseFloat(item.unitPrice.toString()),
          taxRate: parseFloat(item.taxRate.toString())
        }))
      };
      if (editingInvoice) {
        await api.put(`/invoices/${editingInvoice.id}`, payload);
      } else {
        await api.post('/invoices', payload);
      }
      setIsModalOpen(false);
      setEditingInvoice(null);
      fetchData();
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const openEditInvoice = async (invoice: Invoice) => {
    if (isAccountant) return;
    try {
      const { data } = await api.get(`/invoices/${invoice.id}/items`);
      const mappedItems = (Array.isArray(data) ? data : []).map((it: any) => ({
        productId: String(it.productId || ''),
        quantity: Number(it.quantity || 1),
        unitPrice: Number(it.unitPrice || 0),
        taxRate: Number(it.taxRate || 20),
      }));
      setFormData({
        clientId: String(invoice.clientId || ''),
        date: invoiceCalendarDay(invoice.date) || new Date().toISOString().split('T')[0],
        items: mappedItems.length ? mappedItems : [{ productId: '', quantity: 1, unitPrice: 0, taxRate: 20 }],
      });
      setEditingInvoice(invoice);
      setIsModalOpen(true);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Impossible de charger la facture pour modification.');
    }
  };

  const openCreateClientModal = () => {
    setNewClientData({ name: '', email: '', phone: '', address: '', taxNumber: '' });
    setIsCreateClientOpen(true);
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAccountant) return;
    try {
      setCreatingClient(true);
      await api.post('/clients', newClientData);
      const clientsRes = await api.get('/clients');
      const allClients = clientsRes.data || [];
      setClients(allClients);
      const createdClient = allClients[allClients.length - 1];
      if (createdClient?.id) {
        setFormData((prev) => ({ ...prev, clientId: String(createdClient.id) }));
      }
      setIsCreateClientOpen(false);
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Erreur lors de la creation du client.');
    } finally {
      setCreatingClient(false);
    }
  };

  const { filteredInvoices, listTotals } = useMemo(() => {
    const paymentStatusRank = (inv: Invoice) => {
      if (inv.paymentStatus === 'paid' || Number(inv.completed)) return 3;
      if (inv.paymentStatus === 'partial') return 2;
      return 1;
    };

    const filtered = invoices.filter((invoice) => {
      const searchOk =
        invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.clientName.toLowerCase().includes(searchTerm.toLowerCase());
      if (!searchOk) return false;
      if (!filterByDate) return true;
      return invoiceCalendarDay(invoice.date) === filterByDate;
    });

    const sorted = [...filtered].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (sortMode === 'date_desc') return dateB - dateA;
      if (sortMode === 'date_asc') return dateA - dateB;
      if (sortMode === 'status_unpaid_first') {
        const d = paymentStatusRank(a) - paymentStatusRank(b);
        if (d !== 0) return d;
        return dateB - dateA;
      }
      const d = paymentStatusRank(b) - paymentStatusRank(a);
      if (d !== 0) return d;
      return dateB - dateA;
    });

    const listTotals = sorted.reduce(
      (acc, inv) => {
        const ttc = Number(inv.totalInclTax) || 0;
        const paid = Number(inv.totalPaid || 0);
        const reste =
          inv.remaining !== undefined && inv.remaining !== null
            ? Number(inv.remaining)
            : ttc;
        acc.montantTTC += ttc;
        acc.regle += paid;
        acc.reste += reste;
        return acc;
      },
      { montantTTC: 0, regle: 0, reste: 0 }
    );

    return { filteredInvoices: sorted, listTotals };
  }, [invoices, searchTerm, sortMode, filterByDate]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Gestion des Factures</h1>
          <p className="text-slate-500 font-medium mt-1">Suivez vos ventes et facturations clients.</p>
        </div>
        <button 
          onClick={() => {
            if (!isAccountant) {
              setEditingInvoice(null);
              setFormData({
                clientId: '',
                date: new Date().toISOString().split('T')[0],
                items: [{ productId: '', quantity: 1, unitPrice: 0, taxRate: 20 }]
              });
              setIsModalOpen(true);
            }
          }}
          disabled={isAccountant}
          className="flex items-center space-x-2 bg-emerald-600 text-white px-6 py-2.5 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 font-bold disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="w-5 h-5" />
          <span>Nouvelle Facture</span>
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/30">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Rechercher une facture..." 
              className="pl-12 pr-4 py-3 w-full bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {isAdmin && (
              <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-600">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Afficher archivées
              </label>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <label htmlFor="invoice-filter-date" className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Date
              </label>
              <input
                id="invoice-filter-date"
                type="date"
                className="min-w-[11rem] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={filterByDate}
                onChange={(e) => setFilterByDate(e.target.value)}
                title="Choisir un jour — seules les factures de ce jour sont affichées"
              />
              {filterByDate ? (
                <button
                  type="button"
                  onClick={() => setFilterByDate('')}
                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                  title="Afficher toutes les dates"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Trier:</span>
            <select
              className="min-w-[14rem] bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={sortMode}
              onChange={(e) =>
                setSortMode(e.target.value as typeof sortMode)
              }
            >
              <option value="date_desc">Date — plus récent</option>
              <option value="date_asc">Date — plus ancien</option>
              <option value="status_unpaid_first">Statut — en attente d’abord</option>
              <option value="status_paid_first">Statut — payées d’abord</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">N° Facture</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Client</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Date</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Montant TTC</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Regle</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Reste</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Statut</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="px-8 py-20 text-center text-slate-400 font-medium">Chargement...</td></tr>
              ) : filteredInvoices.length === 0 ? (
                <tr><td colSpan={8} className="px-8 py-20 text-center text-slate-400 font-medium">Aucune facture trouvée.</td></tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                          <FileText className="w-4 h-4" />
                        </div>
                        <span className="font-black text-slate-900 tracking-tight">{invoice.invoiceNumber}</span>
                        {Number(invoice.completed || 0) ? (
                          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-violet-700">
                            Terminée
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-8 py-6 font-bold text-slate-700">{invoice.clientName}</td>
                    <td className="px-8 py-6 text-sm font-medium text-slate-500">{invoice.date}</td>
                    <td className="px-8 py-6 text-right font-mono font-black text-slate-900">
                      {invoice.totalInclTax.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                    </td>
                    <td className="px-8 py-6 text-right font-mono font-black text-emerald-700">
                      {Number(invoice.totalPaid || 0).toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                    </td>
                    <td className="px-8 py-6 text-right font-mono font-black text-rose-600">
                      {Number(invoice.remaining ?? invoice.totalInclTax).toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                    </td>
                    <td className="px-8 py-6">
                      {Number(invoice.completed || 0) ? (
                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-50 text-violet-700">
                          Terminée
                        </span>
                      ) : (
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            invoice.paymentStatus === 'paid'
                              ? 'bg-emerald-50 text-emerald-600'
                              : invoice.paymentStatus === 'partial'
                                ? 'bg-blue-50 text-blue-600'
                                : 'bg-amber-50 text-amber-600'
                          }`}
                        >
                          {invoice.paymentStatus === 'paid'
                            ? 'Payée'
                            : invoice.paymentStatus === 'partial'
                              ? 'Partielle'
                              : 'En attente'}
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button onClick={() => openTimeline(invoice)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Historique paiements">
                          <History className="w-5 h-5" />
                        </button>
                        {!isAccountant ? (
                          <button
                            type="button"
                            onClick={() => void openEditInvoice(invoice)}
                            className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-xl transition-all"
                            title="Modifier facture"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => toggleInvoiceCompleted(invoice, !Number(invoice.completed || 0))}
                          className={`p-2 rounded-xl transition-all ${
                            Number(invoice.completed || 0)
                              ? 'text-violet-600 bg-violet-50 hover:bg-violet-100'
                              : 'text-slate-400 hover:text-violet-600 hover:bg-violet-50'
                          }`}
                          title={Number(invoice.completed || 0) ? 'Retirer le marquage terminé' : 'Marquer comme terminée'}
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => toggleArchive(invoice, !invoice.archived)}
                            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
                            title={invoice.archived ? 'Restaurer' : 'Archiver'}
                          >
                            <Archive className="w-5 h-5" />
                          </button>
                        )}
                        {isAdmin && Number(invoice.completed || 0) ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteInvoice(invoice)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                            title="Supprimer définitivement"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        ) : null}
                        <button onClick={() => handleConvertToBL(invoice.id)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Convertir en BL">
                          <Truck className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleOpenConvertBC(invoice.id)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all" title="Convertir en BC">
                          <ShoppingCart className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleDownloadPDF(invoice)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all" title="Télécharger PDF">
                          <Download className="w-5 h-5" />
                        </button>
                        <SendDocumentActions
                          preparePdf={() => prepareInvoicePdf(invoice)}
                          recipientType="client"
                          recipientId={invoice.clientId}
                          subject={`Facture ${invoice.invoiceNumber}`}
                          caption={`Bonjour, veuillez trouver ci-joint la facture ${invoice.invoiceNumber}.`}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && filteredInvoices.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-emerald-200 bg-emerald-50/90">
                  <td colSpan={3} className="px-8 py-4 text-sm font-black uppercase tracking-widest text-emerald-900">
                    Totaux (liste affichée · {filteredInvoices.length} facture
                    {filteredInvoices.length > 1 ? 's' : ''})
                  </td>
                  <td className="px-8 py-4 text-right font-mono text-base font-black text-slate-900">
                    {listTotals.montantTTC.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                  </td>
                  <td className="px-8 py-4 text-right font-mono text-base font-black text-emerald-800">
                    {listTotals.regle.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                  </td>
                  <td className="px-8 py-4 text-right font-mono text-base font-black text-rose-700">
                    {listTotals.reste.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                  </td>
                  <td colSpan={2} className="px-8 py-4 text-xs font-bold text-emerald-800/80">
                    Montant TTC · Réglé · Reste
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {timelineInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-6">
              <h2 className="text-lg font-black text-slate-800">Paiements — {timelineInvoice.invoiceNumber}</h2>
              <button type="button" onClick={() => setTimelineInvoice(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto p-6">
              {timelineEvents.length === 0 ? (
                <p className="text-center text-sm text-slate-500">Aucun paiement lié.</p>
              ) : (
                timelineEvents.map((ev, i) => (
                  <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-sm">
                    <div className="flex justify-between font-black text-slate-800">
                      <span>{ev.kind === 'cash' ? 'Espèces' : 'Chèque'}</span>
                      <span>{ev.amount.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD</span>
                    </div>
                    <div className="mt-1 text-slate-600">{ev.date}</div>
                    <div className="font-mono text-xs text-slate-500">{ev.reference}</div>
                    {ev.detail && <div className="text-xs text-slate-500">{ev.detail}</div>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Convert to BC Modal */}
      {isConvertModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-black text-slate-800 flex items-center space-x-2">
                <ShoppingCart className="w-6 h-6 text-emerald-600" />
                <span>Convertir en Bon de Commande</span>
              </h2>
              <button onClick={() => setIsConvertModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-8 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Sélectionner le Fournisseur</label>
                <select 
                  required
                  className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                >
                  <option value="">Choisir un fournisseur...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="pt-4 flex space-x-3">
                <button 
                  type="button"
                  onClick={() => setIsConvertModalOpen(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-2xl text-gray-600 font-bold hover:bg-gray-50 transition-all"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleConvertToBC}
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all"
                >
                  Convertir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-black text-slate-800 flex items-center space-x-2">
                <FileText className="w-6 h-6 text-blue-600" />
                <span>{editingInvoice ? `Modifier ${editingInvoice.invoiceNumber}` : 'Nouvelle Facture'}</span>
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingInvoice(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Client</label>
                  <select required className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-700" value={formData.clientId} onChange={(e) => {
                    const value = e.target.value;
                    if (value === CREATE_CLIENT_OPTION) {
                      openCreateClientModal();
                      return;
                    }
                    setFormData({...formData, clientId: value});
                  }}>
                    <option value="">Sélectionner un client</option>
                    <option value={CREATE_CLIENT_OPTION}>+ Creer un client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Date</label>
                  <input type="date" required className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-700" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                  <h3 className="text-lg font-black text-slate-800">Articles</h3>
                  <button type="button" onClick={handleAddItem} className="text-xs text-blue-600 hover:text-blue-700 font-black uppercase tracking-widest flex items-center space-x-2 px-4 py-2 bg-blue-50 rounded-xl transition-all">
                    <Plus className="w-4 h-4" />
                    <span>Ajouter un article</span>
                  </button>
                </div>
                
                <div className="space-y-3">
                  {formData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-4 items-end bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                      <div className="col-span-5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Produit</label>
                        <select required className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700" value={item.productId} onChange={(e) => handleItemChange(index, 'productId', e.target.value)}>
                          <option value="">Choisir...</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Qté</label>
                        <input type="number" min="1" required className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} />
                      </div>
                      <div className="col-span-3">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Prix HT</label>
                        <input type="number" step="0.01" required className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700" value={item.unitPrice} onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)} />
                      </div>
                      <div className="col-span-2 text-right">
                        <button type="button" onClick={() => setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) })} className="p-2.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 flex space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingInvoice(null);
                  }}
                  className="flex-1 px-4 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all"
                >
                  Annuler
                </button>
                <button type="submit" className="flex-1 px-4 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all flex items-center justify-center space-x-2">
                  <Save className="w-4 h-4" />
                  <span>{editingInvoice ? 'Enregistrer les modifications' : 'Générer la Facture'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isCreateClientOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-black text-slate-800">Nouveau Client</h2>
              <button type="button" onClick={() => setIsCreateClientOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCreateClient} className="p-8 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Nom Complet</label>
                <input type="text" required className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-700" value={newClientData.name} onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Telephone</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-700" value={newClientData.phone} onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Matricule Fiscale</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-700" value={newClientData.taxNumber} onChange={(e) => setNewClientData({ ...newClientData, taxNumber: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Email</label>
                <input type="email" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-700" value={newClientData.email} onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Adresse</label>
                <textarea rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-700" value={newClientData.address} onChange={(e) => setNewClientData({ ...newClientData, address: e.target.value })} />
              </div>
              <div className="pt-4 flex space-x-3">
                <button type="button" onClick={() => setIsCreateClientOpen(false)} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all">Annuler</button>
                <button type="submit" disabled={creatingClient} className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all disabled:opacity-60">
                  {creatingClient ? 'Creation...' : 'Creer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;
