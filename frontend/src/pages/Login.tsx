import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { LogIn, ShieldCheck, Building2, Loader2 } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/auth/login', { email, password });
      setAuth(response.data.user, response.data.token);
      setShowWelcome(true);
      // Wait for animation before navigating
      setTimeout(() => {
        navigate('/');
      }, 2500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Une erreur est survenue lors de la connexion.');
      setLoading(false);
    }
  };

  if (showWelcome) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white overflow-hidden">
        <div className="relative">
          {/* Animated Background Circles */}
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-emerald-50 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-50 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
          
          <div className="relative flex flex-col items-center space-y-6 text-center animate-in fade-in zoom-in duration-700">
            <div className="w-24 h-24 bg-emerald-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-200 rotate-12 animate-bounce">
              <Building2 className="w-12 h-12 text-white -rotate-12" />
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                Bienvenue, {useAuthStore.getState().user?.name} !
              </h1>
              <p className="text-gray-500 font-medium text-lg">Préparation de votre espace de travail...</p>
            </div>
            <div className="flex items-center space-x-2 text-emerald-600 font-bold uppercase tracking-widest text-xs">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Chargement du système B2B</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-100/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/30 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl shadow-2xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
          <div className="p-8 pb-0 text-center">
            <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-100 mb-6">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">SA COMPANY</h2>
            <p className="mt-2 text-sm font-medium text-gray-500">Système de Facturation B2B</p>
          </div>

          <div className="p-8">
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-2xl bg-red-50 p-4 border border-red-100 animate-in slide-in-from-top-2 duration-300">
                  <div className="text-sm text-red-700 font-semibold text-center">{error}</div>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Adresse Email</label>
                  <input
                    type="email"
                    required
                    className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                    placeholder="nom@entreprise.ma"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Mot de passe</label>
                  <input
                    type="password"
                    required
                    className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between px-1">
                <div className="flex items-center">
                  <input id="remember-me" type="checkbox" className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded-md" />
                  <label htmlFor="remember-me" className="ml-2 block text-xs font-bold text-gray-500 uppercase tracking-tighter">Se souvenir de moi</label>
                </div>
                <a href="#" className="text-xs font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-tighter">Oublié ?</a>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-sm font-black rounded-2xl text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span className="flex items-center space-x-2">
                    <span>SE CONNECTER</span>
                    <LogIn className="w-4 h-4" />
                  </span>
                )}
              </button>
            </form>
          </div>
          
          <div className="p-6 bg-gray-50 border-t border-gray-100 text-center">
            <div className="flex items-center justify-center space-x-2 text-gray-400">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Connexion Sécurisée SSL</span>
            </div>
          </div>
        </div>
        <p className="mt-8 text-center text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">
          &copy; 2026 SA COMPANY B2B
        </p>
      </div>
    </div>
  );
};

export default Login;
