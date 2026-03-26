import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, Edit2, Trash2, Search, X, History, MessageSquare, ShoppingCart, Truck, Calendar, Upload, Download, ChevronRight, Save } from 'lucide-react';
import Papa from 'papaparse';

interface Supplier {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxNumber: string | null;
}

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    taxNumber: ''
  });

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/suppliers');
      setSuppliers(response.data);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleOpenHistory = async (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsHistoryOpen(true);
    try {
      const response = await api.get('/purchase-orders');
      const filtered = response.data.filter((o: any) => o.supplierName === supplier.name);
      setHistoryData(filtered.map((o: any) => ({ ...o, type: 'Bon de Commande', icon: ShoppingCart, color: 'text-emerald-600', bgColor: 'bg-emerald-50' })));
    } catch (error) {
      console.error('Erreur history:', error);
    }
  };

  const handleOpenModal = (supplier: Supplier | null = null) => {
    if (supplier) {
      setSelectedSupplier(supplier);
      setFormData({
        name: supplier.name,
        email: supplier.email || '',
        phone: supplier.phone || '',
        address: supplier.address || '',
        taxNumber: supplier.taxNumber || ''
      });
    } else {
      setSelectedSupplier(null);
      setFormData({ name: '', email: '', phone: '', address: '', taxNumber: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedSupplier) {
        await api.put(`/suppliers/${selectedSupplier.id}`, formData);
      } else {
        await api.post('/suppliers', formData);
      }
      setIsModalOpen(false);
      fetchSuppliers();
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Supprimer ce fournisseur ?')) {
      try {
        await api.delete(`/suppliers/${id}`);
        fetchSuppliers();
      } catch (error) {
        console.error('Erreur:', error);
      }
    }
  };

  const filteredSuppliers = suppliers
    .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      return sortOrder === 'asc' 
        ? a.name.localeCompare(b.name) 
        : b.name.localeCompare(a.name);
    });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Gestion des Fournisseurs</h1>
          <p className="text-slate-500 font-medium mt-1">Gérez vos relations et documents fournisseurs.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="flex items-center space-x-2 bg-emerald-600 text-white px-6 py-2.5 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 font-bold">
          <Plus className="w-5 h-5" />
          <span>Nouveau Fournisseur</span>
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/30">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input type="text" placeholder="Rechercher un fournisseur..." className="pl-12 pr-4 py-3 w-full bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Trier:</span>
            <select 
              className="border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
            >
              <option value="asc">Nom (A-Z)</option>
              <option value="desc">Nom (Z-A)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Fournisseur</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Contact</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Identifiant</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={4} className="px-8 py-20 text-center text-slate-400 font-medium">Chargement...</td></tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr><td colSpan={4} className="px-8 py-20 text-center text-slate-400 font-medium">Aucun fournisseur trouvé.</td></tr>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-black text-xs group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                          {supplier.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{supplier.name}</div>
                          <div className="text-xs text-slate-400 font-medium truncate max-w-[200px]">{supplier.address || 'Pas d\'adresse'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-sm font-bold text-slate-700">{supplier.phone || '-'}</div>
                      <div className="text-xs text-gray-400 font-medium">{supplier.email || '-'}</div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider">
                        ICE: {supplier.taxNumber || 'N/A'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button onClick={() => handleOpenHistory(supplier)} className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all" title="Historique">
                          <History className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleOpenModal(supplier)} className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all">
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleDelete(supplier.id)} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                          <Trash2 className="w-5 h-5" />
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

      {/* History Modal */}
      {isHistoryOpen && selectedSupplier && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h2 className="text-xl font-black text-slate-800">Historique : {selectedSupplier.name}</h2>
                <p className="text-sm text-slate-500 font-medium">Documents d'achat</p>
              </div>
              <button onClick={() => setIsHistoryOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4 custom-scrollbar">
              {historyData.length === 0 ? (
                <div className="text-center py-10 text-slate-400 font-medium">Aucun historique trouvé.</div>
              ) : (
                historyData.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-5 bg-slate-50/50 rounded-[1.5rem] border border-slate-100 hover:bg-white hover:shadow-sm transition-all">
                    <div className="flex items-center space-x-4">
                      <div className={`p-3 rounded-xl bg-white shadow-sm ${item.color}`}>
                        <item.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-black text-slate-800 text-sm">{item.type} n° {item.orderNumber}</div>
                        <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center space-x-1 mt-1">
                          <Calendar className="w-3 h-3" />
                          <span>{item.date}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-slate-900">{item.totalInclTax.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD</div>
                      <div className="text-[10px] font-black uppercase tracking-tighter text-slate-400 mt-1">{item.status}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50/30 flex space-x-3">
              <button className="flex-1 flex items-center justify-center space-x-2 py-3 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
                <MessageSquare className="w-4 h-4" />
                <span>Nouvelle Interaction</span>
              </button>
              <button onClick={() => setIsHistoryOpen(false)} className="px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-black text-slate-800">{selectedSupplier ? 'Modifier' : 'Nouveau'} Fournisseur</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Nom du Fournisseur</label>
                <input type="text" required className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all font-bold text-slate-700" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Téléphone</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all font-bold text-slate-700" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Matricule Fiscale</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all font-bold text-slate-700" value={formData.taxNumber} onChange={(e) => setFormData({...formData, taxNumber: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Email</label>
                <input type="email" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all font-bold text-slate-700" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Adresse</label>
                <textarea className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all font-bold text-slate-700" rows={3} value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
              </div>
              <div className="pt-4 flex space-x-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-gray-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all">Annuler</button>
                <button type="submit" className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all flex items-center justify-center space-x-2">
                  <Save className="w-4 h-4" />
                  <span>Enregistrer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
