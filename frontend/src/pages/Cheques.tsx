import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, Search, FileText, Calendar, User, Check, X, CreditCard, ArrowDownLeft, ArrowUpRight, AlertCircle, RotateCcw, Calculator, Save } from 'lucide-react';

interface Cheque {
  id: number;
  chequeNumber: string;
  bankName: string | null;
  amount: number;
  issueDate: string;
  dueDate: string;
  type: 'incoming' | 'outgoing';
  status: 'pending' | 'cleared' | 'bounced';
  isPaid: number;
  clientName: string | null;
  supplierName: string | null;
}

const Cheques = () => {
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    chequeNumber: '',
    bankName: '',
    amount: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    type: 'incoming',
    clientId: '',
    supplierId: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [chequesRes, clientsRes, suppliersRes] = await Promise.all([
        api.get('/cheques'),
        api.get('/clients'),
        api.get('/suppliers')
      ]);
      setCheques(chequesRes.data);
      setClients(clientsRes.data);
      setSuppliers(suppliersRes.data);
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
    const data = {
      ...formData,
      amount: parseFloat(formData.amount),
      clientId: formData.type === 'incoming' ? (formData.clientId ? parseInt(formData.clientId) : null) : null,
      supplierId: formData.type === 'outgoing' ? (formData.supplierId ? parseInt(formData.supplierId) : null) : null,
    };
    try {
      await api.post('/cheques', data);
      setIsModalOpen(false);
      setFormData({
        chequeNumber: '',
        bankName: '',
        amount: '',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        type: 'incoming',
        clientId: '',
        supplierId: ''
      });
      fetchData();
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const togglePaid = async (id: number, currentPaid: number) => {
    try {
      await api.put(`/cheques/${id}/status`, { isPaid: currentPaid === 1 ? 0 : 1 });
      fetchData();
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      await api.put(`/cheques/${id}/status`, { status });
      fetchData();
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const ChequeTable = ({ type }: { type: 'incoming' | 'outgoing' }) => {
    const filtered = cheques.filter(c => c.type === type);
    const title = type === 'incoming' ? "Chèques Reçus (Clients)" : "Chèques Émis (Fournisseurs)";
    const colorClass = type === 'incoming' ? "text-emerald-600 bg-emerald-50" : "text-amber-600 bg-amber-50";
    const Icon = type === 'incoming' ? ArrowDownLeft : ArrowUpRight;

    return (
      <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden mb-10">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-2xl ${colorClass} shadow-sm`}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">{title}</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{filtered.length} chèques au total</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] w-16">Payé</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">N° Chèque</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{type === 'incoming' ? 'Client' : 'Fournisseur'}</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Montant</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Échéance</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Statut</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-8 py-20 text-center text-slate-400 font-medium">Aucun chèque enregistré.</td></tr>
              ) : (
                filtered.map((cheque) => (
                  <tr key={cheque.id} className={`hover:bg-slate-50/50 transition-colors ${cheque.isPaid ? 'bg-slate-50/30' : ''}`}>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-center">
                        <input 
                          type="checkbox" 
                          checked={cheque.isPaid === 1}
                          onChange={() => togglePaid(cheque.id, cheque.isPaid)}
                          className="w-5 h-5 text-emerald-600 rounded-lg border-slate-200 focus:ring-emerald-500 cursor-pointer transition-all"
                        />
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className={`font-black tracking-tight ${cheque.isPaid ? 'text-slate-300 line-through' : 'text-slate-900'}`}>{cheque.chequeNumber}</div>
                      <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{cheque.bankName || 'Banque non spécifiée'}</div>
                    </td>
                    <td className="px-8 py-6 font-bold text-slate-600">
                      {type === 'incoming' ? cheque.clientName : cheque.supplierName}
                    </td>
                    <td className="px-8 py-6 text-right font-mono font-black text-slate-900">
                      {cheque.amount.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center space-x-2 font-black text-slate-500 text-xs uppercase tracking-tighter">
                        <Calendar className="w-3.5 h-3.5 text-slate-300" />
                        <span>{cheque.dueDate}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        cheque.status === 'cleared' ? 'bg-emerald-50 text-emerald-600' :
                        cheque.status === 'bounced' ? 'bg-rose-50 text-rose-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>
                        {cheque.status === 'cleared' ? 'Encaissé' : cheque.status === 'bounced' ? 'Impayé' : 'En attente'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        {cheque.status === 'pending' ? (
                          <>
                            <button onClick={() => updateStatus(cheque.id, 'cleared')} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all" title="Marquer comme encaissé">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => updateStatus(cheque.id, 'bounced')} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all" title="Marquer comme impayé">
                              <AlertCircle className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button onClick={() => updateStatus(cheque.id, 'pending')} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Remettre en attente">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Registre des Chèques</h1>
          <p className="text-slate-500 font-medium mt-1">Suivez vos encaissements et décaissements par chèque.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 bg-purple-600 text-white px-6 py-2.5 rounded-2xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-100 font-bold"
        >
          <Plus className="w-5 h-5" />
          <span>Enregistrer un Chèque</span>
        </button>
      </div>

      <ChequeTable type="incoming" />
      <ChequeTable type="outgoing" />

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-black text-slate-800 flex items-center space-x-3">
                <div className="p-2 bg-white rounded-xl shadow-sm">
                  <CreditCard className="w-6 h-6 text-purple-600" />
                </div>
                <span>Nouveau Chèque</span>
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/60">
                <button 
                  type="button"
                  className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${formData.type === 'incoming' ? 'bg-white text-purple-600 shadow-sm border border-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}
                  onClick={() => setFormData({...formData, type: 'incoming'})}
                >
                  Reçu (Client)
                </button>
                <button 
                  type="button"
                  className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${formData.type === 'outgoing' ? 'bg-white text-purple-600 shadow-sm border border-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}
                  onClick={() => setFormData({...formData, type: 'outgoing'})}
                >
                  Émis (Fournisseur)
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">N° Chèque</label>
                  <input type="text" required className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none transition-all font-bold text-slate-700" value={formData.chequeNumber} onChange={(e) => setFormData({...formData, chequeNumber: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Banque</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none transition-all font-bold text-slate-700" value={formData.bankName} onChange={(e) => setFormData({...formData, bankName: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">{formData.type === 'incoming' ? 'Client' : 'Fournisseur'}</label>
                <select required className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none transition-all font-bold text-slate-700" value={formData.type === 'incoming' ? formData.clientId : formData.supplierId} onChange={(e) => setFormData({...formData, [formData.type === 'incoming' ? 'clientId' : 'supplierId']: e.target.value})}>
                  <option value="">Sélectionner...</option>
                  {formData.type === 'incoming' ? clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>) : suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Montant (MAD)</label>
                  <input type="number" step="0.01" required className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none transition-all font-bold text-slate-700" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Échéance</label>
                  <input type="date" required className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none transition-all font-bold text-slate-700" value={formData.dueDate} onChange={(e) => setFormData({...formData, dueDate: e.target.value})} />
                </div>
              </div>

              <div className="pt-4 flex space-x-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all">Annuler</button>
                <button type="submit" className="flex-1 px-4 py-4 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-purple-700 shadow-lg shadow-purple-100 transition-all flex items-center justify-center space-x-2">
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

export default Cheques;
