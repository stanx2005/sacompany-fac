import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, Edit2, Trash2, Search, X, History, MessageSquare, FileText, ShoppingCart, Truck, Calendar, Upload, Download, ChevronRight, Save } from 'lucide-react';
import Papa from 'papaparse';

interface Client {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxNumber: string | null;
}

const Clients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    taxNumber: ''
  });

  const fetchClients = async () => {
    try {
      setLoading(true);
      const response = await api.get('/clients');
      setClients(response.data);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        try {
          await api.post('/clients/bulk', { clients: results.data });
          alert('Importation réussie !');
          fetchClients();
        } catch (error) {
          alert('Erreur lors de l\'importation CSV.');
        }
      }
    });
  };

  const handleOpenHistory = async (client: Client) => {
    setSelectedClient(client);
    setIsHistoryOpen(true);
    try {
      const [invoices, notes, quotesRes] = await Promise.all([
        api.get('/invoices'),
        api.get('/delivery-notes'),
        api.get('/quotes')
      ]);
      const clientInvoices = invoices.data.filter((i: any) => i.clientName === client.name);
      const clientNotes = notes.data.filter((n: any) => n.clientName === client.name);
      const clientQuotes = quotesRes.data.filter((q: any) => q.clientName === client.name);
      
      const combined = [
        ...clientInvoices.map((i: any) => ({ ...i, type: 'Facture', icon: FileText, color: 'text-emerald-600', bgColor: 'bg-emerald-50' })),
        ...clientNotes.map((n: any) => ({ ...n, type: 'Bon de Livraison', icon: Truck, color: 'text-blue-600', bgColor: 'bg-blue-50' })),
        ...clientQuotes.map((q: any) => ({ ...q, type: 'Devis', icon: FileText, color: 'text-amber-600', bgColor: 'bg-amber-50' }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setHistoryData(combined);
    } catch (error) {
      console.error('Erreur history:', error);
    }
  };

  const handleOpenModal = (client: Client | null = null) => {
    if (client) {
      setSelectedClient(client);
      setFormData({
        name: client.name,
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        taxNumber: client.taxNumber || ''
      });
    } else {
      setSelectedClient(null);
      setFormData({ name: '', email: '', phone: '', address: '', taxNumber: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedClient) {
        await api.put(`/clients/${selectedClient.id}`, formData);
      } else {
        await api.post('/clients', formData);
      }
      setIsModalOpen(false);
      fetchClients();
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Supprimer ce client ?')) {
      try {
        await api.delete(`/clients/${id}`);
        fetchClients();
      } catch (error: any) {
        const message =
          error?.response?.data?.message ||
          'Suppression impossible pour ce client.';
        alert(message);
        console.error('Erreur suppression client:', error);
      }
    }
  };

  const filteredClients = clients
    .filter(client => 
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.phone && client.phone.includes(searchTerm))
    )
    .sort((a, b) => {
      return sortOrder === 'asc' 
        ? a.name.localeCompare(b.name) 
        : b.name.localeCompare(a.name);
    });

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Gestion des Clients</h1>
          <p className="mt-1 font-medium text-slate-500">Consultez et gérez votre base de données clients.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <label className="flex min-h-[44px] cursor-pointer items-center space-x-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 sm:px-5">
            <Upload className="h-4 w-4 shrink-0" />
            <span>Importer</span>
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </label>
          <button type="button" onClick={() => handleOpenModal()} className="flex min-h-[44px] items-center space-x-2 rounded-2xl bg-emerald-600 px-4 py-2.5 font-bold text-white shadow-lg shadow-emerald-100 transition-all hover:bg-emerald-700 sm:px-6">
            <Plus className="h-5 w-5 shrink-0" />
            <span className="whitespace-nowrap">Nouveau Client</span>
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/60 bg-white shadow-sm sm:rounded-[2.5rem]">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/30">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input type="text" placeholder="Rechercher un client..." className="pl-12 pr-4 py-3 w-full bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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

        <div className="-mx-px overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 sm:px-6 sm:py-5 sm:text-[11px] sm:tracking-[0.2em] lg:px-8">Client</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 sm:px-6 sm:py-5 sm:text-[11px] sm:tracking-[0.2em] lg:px-8">Contact</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 sm:px-6 sm:py-5 sm:text-[11px] sm:tracking-[0.2em] lg:px-8">Identifiant</th>
                <th className="px-4 py-4 text-right text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 sm:px-6 sm:py-5 sm:text-[11px] sm:tracking-[0.2em] lg:px-8">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-16 text-center font-medium text-slate-400 sm:px-8 sm:py-20">Chargement des données...</td></tr>
              ) : filteredClients.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-16 text-center font-medium text-slate-400 sm:px-8 sm:py-20">Aucun client trouvé.</td></tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="group transition-colors hover:bg-slate-50/50">
                    <td className="px-4 py-5 sm:px-6 lg:px-8">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-black text-xs group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                          {client.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{client.name}</div>
                          <div className="text-xs text-slate-400 font-medium truncate max-w-[200px]">{client.address || 'Pas d\'adresse'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-5 sm:px-6 lg:px-8">
                      <div className="text-sm font-bold text-slate-700">{client.phone || '-'}</div>
                      <div className="text-xs font-medium text-slate-400">{client.email || '-'}</div>
                    </td>
                    <td className="px-4 py-5 sm:px-6 lg:px-8">
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider">
                        ICE: {client.taxNumber || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-5 text-right sm:px-6 lg:px-8">
                      <div className="flex items-center justify-end gap-1 sm:gap-2">
                        <button type="button" onClick={() => handleOpenHistory(client)} className="rounded-xl p-2.5 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600" title="Historique">
                          <History className="w-5 h-5" />
                        </button>
                        <button type="button" onClick={() => handleOpenModal(client)} className="rounded-xl p-2.5 text-slate-400 transition-all hover:bg-emerald-50 hover:text-emerald-600">
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button type="button" onClick={() => handleDelete(client.id)} className="rounded-xl p-2.5 text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-600">
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
      {isHistoryOpen && selectedClient && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h2 className="text-xl font-black text-slate-800">Historique : {selectedClient.name}</h2>
                <p className="text-sm text-slate-500 font-medium">Toutes les interactions et documents</p>
              </div>
              <button onClick={() => setIsHistoryOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4 custom-scrollbar">
              {historyData.length === 0 ? (
                <div className="text-center py-10 text-slate-400 font-medium">Aucun historique trouvé pour ce client.</div>
              ) : (
                historyData.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-5 bg-slate-50/50 rounded-[1.5rem] border border-slate-100 hover:bg-white hover:shadow-sm transition-all">
                    <div className="flex items-center space-x-4">
                      <div className={`p-3 rounded-xl bg-white shadow-sm ${item.color}`}>
                        <item.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-black text-slate-800 text-sm">{item.type} n° {item.invoiceNumber || item.noteNumber || item.quoteNumber}</div>
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
            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/30 p-4 sm:flex-row sm:space-x-3 sm:p-6">
              <button type="button" className="flex min-h-[44px] flex-1 items-center justify-center space-x-2 rounded-2xl bg-blue-600 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-100 transition-all hover:bg-blue-700">
                <MessageSquare className="h-4 w-4" />
                <span>Nouvelle Interaction</span>
              </button>
              <button type="button" onClick={() => setIsHistoryOpen(false)} className="min-h-[44px] rounded-2xl border border-slate-200 bg-white px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 sm:px-8">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-black text-slate-800">{selectedClient ? 'Modifier' : 'Nouveau'} Client</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Nom Complet</label>
                <input type="text" required className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-700" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Téléphone</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-700" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Matricule Fiscale</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-700" value={formData.taxNumber} onChange={(e) => setFormData({...formData, taxNumber: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Email</label>
                <input type="email" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-700" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Adresse</label>
                <textarea className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-700" rows={3} value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
              </div>
              <div className="pt-4 flex space-x-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all">Annuler</button>
                <button type="submit" className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all flex items-center justify-center space-x-2">
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

export default Clients;
