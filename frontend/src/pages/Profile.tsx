import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { User, Building, Mail, Phone, MapPin, CreditCard, Save, ShieldCheck, X } from 'lucide-react';

const Profile = () => {
  const { user, setAuth, token } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    companyName: user?.companyName || '',
    companyICE: user?.companyICE || '',
    companyAddress: user?.companyAddress || '',
    companyEmail: user?.companyEmail || '',
    companyPhone: user?.companyPhone || '',
    companyRIB: user?.companyRIB || ''
  });

  // Sync form data if user object updates in store
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        companyName: user.companyName || '',
        companyICE: user.companyICE || '',
        companyAddress: user.companyAddress || '',
        companyEmail: user.companyEmail || '',
        companyPhone: user.companyPhone || '',
        companyRIB: user.companyRIB || ''
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await api.put('/auth/profile', formData);
      // Update global store with new user data from server
      useAuthStore.getState().updateUser(response.data.user);
      setMessage({ type: 'success', text: 'Profil et informations de l\'entreprise mis à jour avec succès !' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Une erreur est survenue.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Paramètres du Profil</h1>
        <p className="text-slate-500 font-medium mt-1">Gérez vos informations personnelles et les détails de votre entreprise pour les documents PDF.</p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-2xl flex items-center space-x-2 animate-in slide-in-from-top-2 duration-300 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
          {message.type === 'success' ? <ShieldCheck className="w-5 h-5" /> : <X className="w-5 h-5" />}
          <span className="font-bold text-sm">{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8 pb-20">
        {/* User Info */}
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/30">
            <h2 className="text-lg font-black text-slate-800 flex items-center space-x-3">
              <div className="p-2 bg-white rounded-xl shadow-sm">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <span>Informations Personnelles</span>
            </h2>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nom Complet</label>
              <input 
                type="text" 
                required 
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-700" 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Email de Connexion</label>
              <input 
                type="email" 
                required 
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-700" 
                value={formData.email} 
                onChange={(e) => setFormData({...formData, email: e.target.value})} 
              />
            </div>
          </div>
        </div>

        {/* Company Info */}
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/30">
            <h2 className="text-lg font-black text-slate-800 flex items-center space-x-3">
              <div className="p-2 bg-white rounded-xl shadow-sm">
                <Building className="w-5 h-5 text-emerald-600" />
              </div>
              <span>Détails de l'Entreprise (pour PDF)</span>
            </h2>
          </div>
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nom de l'Entreprise</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all font-bold text-slate-700" 
                  value={formData.companyName} 
                  onChange={(e) => setFormData({...formData, companyName: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">ICE</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all font-bold text-slate-700" 
                  value={formData.companyICE} 
                  onChange={(e) => setFormData({...formData, companyICE: e.target.value})} 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Email Professionnel</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                  <input 
                    type="email" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all font-bold text-slate-700" 
                    value={formData.companyEmail} 
                    onChange={(e) => setFormData({...formData, companyEmail: e.target.value})} 
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Téléphone</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all font-bold text-slate-700" 
                    value={formData.companyPhone} 
                    onChange={(e) => setFormData({...formData, companyPhone: e.target.value})} 
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Adresse Siège Social</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-4 text-slate-300 w-4 h-4" />
                <textarea 
                  rows={2} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all font-bold text-slate-700" 
                  value={formData.companyAddress} 
                  onChange={(e) => setFormData({...formData, companyAddress: e.target.value})} 
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">RIB Bancaire</label>
              <div className="relative">
                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all font-mono font-bold text-slate-700" 
                  value={formData.companyRIB} 
                  onChange={(e) => setFormData({...formData, companyRIB: e.target.value})} 
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={loading} className="flex items-center space-x-3 bg-slate-900 text-white px-10 py-4 rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 font-black uppercase tracking-widest text-xs disabled:opacity-50">
            <Save className="w-5 h-5 text-emerald-400" />
            <span>{loading ? 'Enregistrement...' : 'Enregistrer les modifications'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default Profile;
