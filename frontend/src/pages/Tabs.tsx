import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, CheckCircle, Search, Calendar, User, Package, X, Edit2, Trash2, Calculator, ArrowRight, BookOpen } from 'lucide-react';

interface TabItem {
  id: number;
  clientId: number;
  clientName: string;
  productId: number;
  productName: string;
  productPrice: number;
  productTaxRate: number;
  quantity: number;
  date: string;
}

const Tabs = () => {
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    clientId: '',
    productId: '',
    quantity: '1',
    date: new Date().toISOString().split('T')[0]
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tabsRes, clientsRes, productsRes] = await Promise.all([
        api.get('/tabs'),
        api.get('/clients'),
        api.get('/products')
      ]);
      setTabs(tabsRes.data);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/tabs', {
        ...formData,
        clientId: parseInt(formData.clientId),
        productId: parseInt(formData.productId),
        quantity: parseInt(formData.quantity)
      });
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const handleCloseTab = async (clientId: number) => {
    if (window.confirm('Voulez-vous clôturer toutes les commandes pour ce client et générer une facture ?')) {
      try {
        await api.put(`/tabs/close/${clientId}`);
        fetchData();
      } catch (error) {
        console.error('Erreur:', error);
      }
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (window.confirm('Supprimer cet article du carnet ?')) {
      try {
        await api.delete(`/tabs/${id}`);
        fetchData();
      } catch (error) {
        console.error('Erreur:', error);
      }
    }
  };

  const groupedTabs = tabs.reduce((acc: any, tab) => {
    if (!acc[tab.clientId]) {
      acc[tab.clientId] = {
        id: tab.clientId,
        name: tab.clientName,
        items: [],
        totalTTC: 0
      };
    }
    const itemTotalTTC = tab.quantity * tab.productPrice * (1 + (tab.productTaxRate || 20) / 100);
    acc[tab.clientId].items.push(tab);
    acc[tab.clientId].totalTTC += itemTotalTTC;
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Carnet de Commandes</h1>
          <p className="text-slate-500 font-medium mt-1">Suivez les commandes ouvertes par client avant facturation.</p>
        </div>
        <button 
          onClick={() => {
            setFormData({ ...formData, clientId: '' });
            setIsModalOpen(true);
          }}
          className="flex items-center space-x-2 bg-orange-600 text-white px-6 py-2.5 rounded-2xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-100 font-bold"
        >
          <Plus className="w-5 h-5" />
          <span>Ajouter au Carnet</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {loading ? (
          <div className="col-span-full text-center py-20 text-slate-400 font-medium">Chargement du carnet...</div>
        ) : Object.keys(groupedTabs).length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-4">
              <BookOpen className="w-8 h-8" />
            </div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Aucune commande en cours</p>
          </div>
        ) : (
          Object.entries(groupedTabs).map(([clientId, data]: [string, any]) => (
            <div key={clientId} className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm hover:shadow-xl transition-all flex flex-col group overflow-hidden">
              <div className="p-6 bg-orange-50/30 border-b border-orange-100 flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-orange-600">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 tracking-tight">{data.name}</h3>
                    <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">{data.items.length} articles</span>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <button 
                    onClick={() => {
                      setFormData({ ...formData, clientId: clientId });
                      setIsModalOpen(true);
                    }}
                    className="p-2 text-orange-600 hover:bg-white hover:shadow-sm rounded-xl transition-all"
                    title="Ajouter un produit"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => handleCloseTab(parseInt(clientId))}
                    className="p-2 text-emerald-600 hover:bg-white hover:shadow-sm rounded-xl transition-all"
                    title="Clôturer et facturer"
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 p-6 space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar">
                {data.items.map((item: TabItem) => (
                  <div key={item.id} className="flex justify-between items-center group/item">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-700 truncate text-sm">{item.productName}</div>
                      <div className="text-[10px] text-slate-400 font-black uppercase tracking-tighter flex items-center space-x-1 mt-1">
                        <Calendar className="w-3 h-3" />
                        <span>{item.date}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 ml-4">
                      <div className="text-right">
                        <div className="font-black text-orange-600 text-sm">x{item.quantity}</div>
                        <div className="text-[10px] font-bold text-slate-400">{(item.quantity * item.productPrice * 1.2).toFixed(2)} MAD</div>
                      </div>
                      <button 
                        onClick={() => handleDeleteItem(item.id)}
                        className="opacity-0 group-hover/item:opacity-100 p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 bg-slate-50/50 border-t border-slate-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total à facturer</span>
                  <Calculator className="w-4 h-4 text-slate-300" />
                </div>
                <div className="text-2xl font-black text-slate-900 tracking-tighter">
                  {data.totalTTC.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} <span className="text-sm font-bold text-slate-400 ml-1">MAD</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-black text-slate-800 flex items-center space-x-2">
                <Package className="w-6 h-6 text-orange-600" />
                <span>Ajouter au Carnet</span>
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Client</label>
                <select 
                  required
                  disabled={!!formData.clientId && formData.clientId !== ''}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-bold text-slate-700 disabled:opacity-60"
                  value={formData.clientId}
                  onChange={(e) => setFormData({...formData, clientId: e.target.value})}
                >
                  <option value="">Sélectionner un client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Produit</label>
                <select 
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-bold text-slate-700"
                  value={formData.productId}
                  onChange={(e) => setFormData({...formData, productId: e.target.value})}
                >
                  <option value="">Sélectionner un produit</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Quantité</label>
                  <input 
                    type="number" min="1" required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-bold text-slate-700"
                    value={formData.quantity}
                    onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Date</label>
                  <input 
                    type="date" required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-bold text-slate-700"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                  />
                </div>
              </div>
              <div className="pt-4 flex space-x-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-orange-700 shadow-lg shadow-orange-100 transition-all"
                >
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tabs;
