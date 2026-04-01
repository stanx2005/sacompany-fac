import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, Search, FileText, Calendar, User, Download, CheckCircle, X, History, MessageSquare, ShoppingCart, Truck, Edit2, Trash2, RefreshCw, Save } from 'lucide-react';
import { generatePDF } from '../utils/pdfGenerator';

interface Quote {
  id: number;
  quoteNumber: string;
  date: string;
  totalInclTax: number;
  status: string;
  clientId: number;
  clientName: string;
  taxNumber: string;
  address: string;
  phone: string;
}

const Quotes = () => {
  const CREATE_CLIENT_OPTION = '__create_client__';
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
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
      const [quotesRes, clientsRes, productsRes] = await Promise.all([
        api.get('/quotes'),
        api.get('/clients'),
        api.get('/products')
      ]);
      setQuotes(quotesRes.data);
      setClients(clientsRes.data);
      setProducts(productsRes.data);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDownloadPDF = async (quote: Quote) => {
    try {
      const response = await api.get(`/quotes/${quote.id}/items`);
      const items = response.data;
      const entity = {
        name: quote.clientName,
        taxNumber: quote.taxNumber,
        address: quote.address,
        phone: quote.phone
      };
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      generatePDF("DEVIS", quote, items, entity, user);
    } catch (error) {
      console.error('Erreur PDF:', error);
    }
  };

  const handleOpenEditModal = async (quote: Quote) => {
    try {
      const response = await api.get(`/quotes/${quote.id}/items`);
      setEditingQuote(quote);
      setFormData({
        clientId: quote.clientId.toString(),
        date: quote.date,
        items: response.data.map((item: any) => ({
          productId: item.productId.toString(),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate
        }))
      });
      setIsModalOpen(true);
    } catch (error) {
      console.error('Erreur chargement items:', error);
    }
  };

  const handleConvertToInvoice = async (id: number) => {
    if (window.confirm('Convertir ce Devis en Facture ?')) {
      try {
        await api.post(`/quotes/${id}/convert-invoice`);
        alert('Conversion réussie ! Retrouvez la facture dans la section Factures.');
        fetchData();
      } catch (error) {
        console.error('Erreur conversion:', error);
      }
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
    const data = {
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

    try {
      if (editingQuote) {
        await api.put(`/quotes/${editingQuote.id}`, data);
      } else {
        await api.post('/quotes', data);
      }
      setIsModalOpen(false);
      setEditingQuote(null);
      fetchData();
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const openCreateClientModal = () => {
    setNewClientData({ name: '', email: '', phone: '', address: '', taxNumber: '' });
    setIsCreateClientOpen(true);
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const filteredQuotes = quotes
    .filter((quote) =>
      quote.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.clientName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Gestion des Devis</h1>
          <p className="text-slate-500 font-medium mt-1">Créez et gérez vos propositions commerciales.</p>
        </div>
        <button 
          onClick={() => {
            setEditingQuote(null);
            setFormData({
              clientId: '',
              date: new Date().toISOString().split('T')[0],
              items: [{ productId: '', quantity: 1, unitPrice: 0, taxRate: 20 }]
            });
            setIsModalOpen(true);
          }}
          className="flex items-center space-x-2 bg-emerald-600 text-white px-6 py-2.5 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 font-bold"
        >
          <Plus className="w-5 h-5" />
          <span>Nouveau Devis</span>
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/30">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Rechercher un devis..." 
              className="pl-12 pr-4 py-3 w-full bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Trier:</span>
            <select 
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
            >
              <option value="desc">Plus récent</option>
              <option value="asc">Plus ancien</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">N° Devis</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Client</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Date</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Total TTC</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Statut</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-8 py-20 text-center text-slate-400 font-medium">Chargement...</td></tr>
              ) : filteredQuotes.length === 0 ? (
                <tr><td colSpan={6} className="px-8 py-20 text-center text-slate-400 font-medium">Aucun devis trouvé.</td></tr>
              ) : (
                filteredQuotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                          <FileText className="w-4 h-4" />
                        </div>
                        <span className="font-black text-slate-900 tracking-tight">{quote.quoteNumber}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 font-bold text-slate-700">{quote.clientName}</td>
                    <td className="px-8 py-6 text-sm font-medium text-slate-500">{quote.date}</td>
                    <td className="px-8 py-6 text-right font-mono font-black text-slate-900">
                      {quote.totalInclTax.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        quote.status === 'invoiced' ? 'bg-purple-50 text-purple-600' :
                        quote.status === 'accepted' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {quote.status === 'invoiced' ? 'Facturé' : quote.status === 'accepted' ? 'Accepté' : 'En attente'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        {quote.status !== 'invoiced' && (
                          <>
                            <button onClick={() => handleOpenEditModal(quote)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Modifier">
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button onClick={() => handleConvertToInvoice(quote.id)} className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all" title="Convertir en Facture">
                              <RefreshCw className="w-5 h-5" />
                            </button>
                          </>
                        )}
                        <button onClick={() => handleDownloadPDF(quote)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all" title="Télécharger PDF">
                          <Download className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-black text-slate-800 flex items-center space-x-2">
                <FileText className="w-6 h-6 text-blue-600" />
                <span>{editingQuote ? 'Modifier le Devis' : 'Nouveau Devis'}</span>
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
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
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all">Annuler</button>
                <button type="submit" className="flex-1 px-4 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all flex items-center justify-center space-x-2">
                  <Save className="w-4 h-4" />
                  <span>Enregistrer</span>
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

export default Quotes;
