import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Save, Settings2, Download, Upload, Users, UserPlus, Mail } from 'lucide-react';

type Numbering = Record<string, string>;

type AdminUserRow = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'staff' | 'accountant';
  createdAt?: string | null;
};

const defaultKeys = [
  ['invoice', 'Facture standard'],
  ['invoiceDevis', 'Facture depuis devis'],
  ['invoiceConv', 'Facture depuis BL'],
  ['bl', 'Bon de livraison'],
  ['blConv', 'BL (conversion)'],
  ['bc', 'Bon de commande'],
  ['bcConv', 'BC (conversion facture)'],
  ['quote', 'Devis'],
  ['cash', 'Paiement espèces'],
  ['bonTab', 'Bon carnet (PDF)'],
];

const SettingsPage = () => {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [numbering, setNumbering] = useState<Numbering>({});
  const [footerLegal, setFooterLegal] = useState('');
  const [logoDataUrl, setLogoDataUrl] = useState('');
  const [logoMode, setLogoMode] = useState<'image' | 'text'>('image');
  const [logoText, setLogoText] = useState('');
  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff' as 'admin' | 'staff' | 'accountant',
  });
  const [resettingUserId, setResettingUserId] = useState<number | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [passwordDraftByUserId, setPasswordDraftByUserId] = useState<Record<number, string>>({});
  const [messaging, setMessaging] = useState<{
    resendConfigured: boolean;
    gmailConfigured: boolean;
    emailConfigured: boolean;
    activeEmailProvider: 'resend' | 'gmail' | null;
    whatsappConfigured: boolean;
    ultramsgConfigured: boolean;
    activeWhatsAppProvider: 'ultramsg' | 'meta' | 'twilio' | null;
    emailFromHint: string | null;
  } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/settings');
      setNumbering(data.numbering || {});
      setFooterLegal(data.pdfBranding?.footerLegal || '');
      const savedUrl = data.pdfBranding?.logoDataUrl || '';
      setLogoDataUrl(savedUrl);
      const m = data.pdfBranding?.logoMode;
      setLogoMode(
        m === 'text' || m === 'image'
          ? m
          : savedUrl.startsWith('data:image')
            ? 'image'
            : 'text'
      );
      setLogoText(data.pdfBranding?.logoText || '');
      if (data.messaging) setMessaging(data.messaging);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const loadUsers = async () => {
    if (!isAdmin) return;
    try {
      setUsersLoading(true);
      const { data } = await api.get('/admin/users');
      setAdminUsers(Array.isArray(data) ? data : []);
    } catch {
      setAdminUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin]);

  const handleSave = async () => {
    if (!isAdmin) return;
    if (logoMode === 'image' && logoDataUrl.length > 12 * 1024 * 1024) {
      alert('Logo trop volumineux (max. ~12 Mo en base64). Utilisez une image plus petite ou le bouton « Choisir une image » pour compression automatique.');
      return;
    }
    try {
      setSaving(true);
      await api.put('/settings', {
        numbering,
        pdfBranding: { footerLegal, logoDataUrl, logoMode, logoText },
      });
      alert('Paramètres enregistrés.');
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      const msg = e?.response?.data?.message || 'Erreur enregistrement.';
      alert(d ? `${msg}\n\n${d}` : msg);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 320;
        const maxH = 120;
        let w = img.width;
        let h = img.height;
        const ratio = Math.min(maxW / w, maxH / h, 1);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          setLogoDataUrl(dataUrl);
          setLogoMode('image');
        } catch {
          alert('Impossible de convertir cette image.');
        }
      };
      img.onerror = () => alert('Image invalide.');
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const name = newUser.name.trim();
    const email = newUser.email.trim();
    if (!name || !email || !newUser.password) {
      alert('Renseignez nom, email et mot de passe.');
      return;
    }
    try {
      setCreatingUser(true);
      await api.post('/admin/users', {
        name,
        email,
        password: newUser.password,
        role: newUser.role,
      });
      setNewUser({ name: '', email: '', password: '', role: 'staff' });
      await loadUsers();
      alert('Utilisateur créé.');
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Erreur création utilisateur.';
      alert(msg);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (u: AdminUserRow) => {
    if (!isAdmin) return;
    if (!window.confirm(`Supprimer l'utilisateur ${u.name} (${u.email}) ?`)) return;
    try {
      setDeletingUserId(u.id);
      await api.delete(`/admin/users/${u.id}`);
      await loadUsers();
      alert('Utilisateur supprimé.');
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Erreur suppression utilisateur.';
      alert(msg);
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleResetPassword = async (u: AdminUserRow) => {
    if (!isAdmin) return;
    const newPassword = String(passwordDraftByUserId[u.id] || '');
    if (newPassword.length < 6) {
      alert('Mot de passe : au moins 6 caractères.');
      return;
    }
    try {
      setResettingUserId(u.id);
      await api.patch(`/admin/users/${u.id}/password`, { newPassword });
      setPasswordDraftByUserId((prev) => ({ ...prev, [u.id]: '' }));
      alert('Mot de passe mis à jour.');
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Erreur mise à jour mot de passe.';
      alert(msg);
    } finally {
      setResettingUserId(null);
    }
  };

  const exportJson = async () => {
    if (!isAdmin) return;
    try {
      const { data } = await api.get('/admin/export-json');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export-${Date.now()}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert('Export impossible (droits admin requis).');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500 font-medium">
        Chargement des paramètres…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Paramètres</h1>
        <p className="mt-1 font-medium text-slate-500">
          Préfixes de numérotation et texte PDF. Les modifications de numérotation s’appliquent aux nouveaux documents.
        </p>
      </div>

      <div className="rounded-[2rem] border border-slate-200/60 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-4 flex items-center gap-2 text-slate-800">
          <Mail className="h-6 w-6 text-sky-600" />
          <h2 className="text-lg font-black">Rappels clients (e-mail & WhatsApp)</h2>
        </div>
        {messaging ? (
          <div className="flex flex-col gap-2 text-sm font-bold">
            <p className="text-slate-800">
              EMAIL :{' '}
              <span className={messaging.emailConfigured ? 'text-emerald-600' : 'text-red-600'}>
                {messaging.emailConfigured ? 'actif' : 'inactif'}
              </span>
            </p>
            <p className="text-slate-800">
              WHATSAPP :{' '}
              <span className={messaging.whatsappConfigured ? 'text-emerald-600' : 'text-red-600'}>
                {messaging.whatsappConfigured ? 'actif' : 'inactif'}
              </span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Statut indisponible.</p>
        )}
      </div>

      {isAdmin && (
        <div className="rounded-[2rem] border border-slate-200/60 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex items-center gap-2 text-slate-800">
            <Users className="h-6 w-6 text-indigo-600" />
            <h2 className="text-lg font-black">Utilisateurs</h2>
          </div>
          <p className="mb-6 text-sm text-slate-500">
            Créez des comptes pour votre équipe. Les nouveaux utilisateurs se connectent avec l’email et le mot de passe
            définis ici.
          </p>

          <form onSubmit={handleCreateUser} className="mb-8 grid gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Nom</label>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Email</label>
              <input
                type="email"
                required
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Mot de passe</label>
              <input
                type="password"
                autoComplete="new-password"
                minLength={6}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Rôle</label>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'admin' | 'staff' | 'accountant' })}
              >
                <option value="staff">staff</option>
                <option value="accountant">accountant</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={creatingUser}
                className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 font-black text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700 disabled:opacity-60"
              >
                <UserPlus className="h-5 w-5" />
                {creatingUser ? 'Création…' : 'Créer l’utilisateur'}
              </button>
            </div>
          </form>

          <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Comptes existants</h3>
          {usersLoading ? (
            <p className="text-sm text-slate-500">Chargement…</p>
          ) : adminUsers.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun utilisateur.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
              {adminUsers.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="min-w-40 font-bold text-slate-900">{u.name}</span>
                  <span className="font-mono text-slate-600">{u.email}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                      u.role === 'admin'
                        ? 'bg-amber-100 text-amber-800'
                        : u.role === 'accountant'
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {u.role}
                  </span>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <input
                      type="password"
                      minLength={6}
                      placeholder="Nouveau mot de passe"
                      className="w-44 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                      value={passwordDraftByUserId[u.id] || ''}
                      onChange={(e) =>
                        setPasswordDraftByUserId((prev) => ({ ...prev, [u.id]: e.target.value }))
                      }
                    />
                    <button
                      type="button"
                      disabled={resettingUserId === u.id}
                      onClick={() => handleResetPassword(u)}
                      className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-60"
                    >
                      {resettingUserId === u.id ? 'MAJ...' : 'Changer mdp'}
                    </button>
                    <button
                      type="button"
                      disabled={deletingUserId === u.id}
                      onClick={() => handleDeleteUser(u)}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                    >
                      {deletingUserId === u.id ? 'Suppression...' : 'Supprimer'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="rounded-[2rem] border border-slate-200/60 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-2 text-slate-800">
          <Settings2 className="h-6 w-6 text-emerald-600" />
          <h2 className="text-lg font-black">Numérotation</h2>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Pour les factures : indiquez seulement le préfixe (ex. <code className="rounded bg-slate-100 px-1">FACT-</code>), pas un
          numéro ni une date — la suite (<code className="rounded bg-slate-100 px-1">001</code>,{' '}
          <code className="rounded bg-slate-100 px-1">002</code>…) est ajoutée automatiquement.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {defaultKeys.map(([key, label]) => (
            <div key={key}>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                {label}
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                value={numbering[key] ?? ''}
                onChange={(e) => setNumbering({ ...numbering, [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200/60 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="mb-4 text-lg font-black text-slate-800">PDF — pied de page & logo</h2>
        <p className="mb-4 text-sm text-slate-500">
          Texte légal en bas des PDF (optionnel). Pour l’en-tête (haut à gauche), choisissez soit une{' '}
          <strong>image</strong>, soit un <strong>texte</strong> — comme avant l’upload de fichier. Une URL{' '}
          <code className="rounded bg-slate-100 px-1">https://…</code> seule ne s’affiche pas dans les PDF : pour une image,
          importez un fichier ou collez une <strong>data URL</strong> (<code className="rounded bg-slate-100 px-1">data:image/…</code>
          ).
        </p>
        <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
          Pied de page (légal)
        </label>
        <textarea
          rows={3}
          disabled={!isAdmin}
          className="mb-6 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
          value={footerLegal}
          onChange={(e) => setFooterLegal(e.target.value)}
        />
        <p className="mb-3 text-sm font-bold text-slate-700">En-tête des PDF (logo)</p>
        <div className="grid gap-6 md:grid-cols-2">
          <div
            className={`rounded-2xl border p-4 transition-shadow ${
              logoMode === 'image' ? 'border-emerald-300 bg-emerald-50/40 shadow-sm ring-2 ring-emerald-500/30' : 'border-slate-200 bg-slate-50/30'
            }`}
          >
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="radio"
                name="pdf-logo-mode"
                className="mt-1 h-4 w-4 border-slate-300 text-emerald-600 focus:ring-emerald-500"
                checked={logoMode === 'image'}
                disabled={!isAdmin}
                onChange={() => setLogoMode('image')}
              />
              <span>
                <span className="block text-sm font-black text-slate-800">Image</span>
                <span className="mt-0.5 block text-xs font-medium text-slate-500">
                  Fichier ou data URL — redimensionnement automatique à l’import.
                </span>
              </span>
            </label>
            <div className={`mt-4 space-y-3 pl-7 ${logoMode !== 'image' ? 'pointer-events-none opacity-45' : ''}`}>
              {isAdmin && (
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50">
                  <Upload className="h-4 w-4" />
                  Choisir une image
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
                </label>
              )}
              {logoDataUrl.startsWith('data:image') ? (
                <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-100 bg-white p-3">
                  <img src={logoDataUrl} alt="Aperçu logo" className="h-16 max-w-[220px] object-contain" />
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setLogoDataUrl('')}
                      className="text-sm font-bold text-rose-600 hover:underline"
                    >
                      Retirer l’image
                    </button>
                  )}
                </div>
              ) : null}
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Data URL (optionnel)
                </label>
                <textarea
                  rows={3}
                  disabled={!isAdmin || logoMode !== 'image'}
                  placeholder="data:image/jpeg;base64,..."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                  value={logoDataUrl}
                  onChange={(e) => setLogoDataUrl(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div
            className={`rounded-2xl border p-4 transition-shadow ${
              logoMode === 'text' ? 'border-emerald-300 bg-emerald-50/40 shadow-sm ring-2 ring-emerald-500/30' : 'border-slate-200 bg-slate-50/30'
            }`}
          >
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="radio"
                name="pdf-logo-mode"
                className="mt-1 h-4 w-4 border-slate-300 text-emerald-600 focus:ring-emerald-500"
                checked={logoMode === 'text'}
                disabled={!isAdmin}
                onChange={() => setLogoMode('text')}
              />
              <span>
                <span className="block text-sm font-black text-slate-800">Texte</span>
                <span className="mt-0.5 block text-xs font-medium text-slate-500">
                  Nom ou mention affichée en haut à gauche (plusieurs lignes possibles). Si vide, le nom d’entreprise du profil
                  utilisateur est utilisé.
                </span>
              </span>
            </label>
            <div className={`mt-4 pl-7 ${logoMode !== 'text' ? 'pointer-events-none opacity-45' : ''}`}>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Texte en tête du PDF
              </label>
              <textarea
                rows={6}
                disabled={!isAdmin || logoMode !== 'text'}
                placeholder="Ex. Ma société SARL"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                value={logoText}
                onChange={(e) => setLogoText(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {isAdmin ? (
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-8 py-3.5 font-black text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-700 disabled:opacity-60"
            >
              <Save className="h-5 w-5" />
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button
              type="button"
              onClick={exportJson}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3.5 font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <Download className="h-5 w-5" />
              Export JSON (sauvegarde)
            </button>
          </>
        ) : (
          <p className="text-sm font-medium text-amber-700">
            Connectez-vous en administrateur pour modifier les paramètres et exporter les données.
          </p>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
