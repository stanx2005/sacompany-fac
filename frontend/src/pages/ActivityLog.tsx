import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { ScrollText } from 'lucide-react';

type Row = {
  id: number;
  userId: number | null;
  userName: string | null;
  action: string;
  entityType: string;
  entityId: number | null;
  details: string | null;
  createdAt: string;
};

const ActivityLog = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/activity');
        setRows(data);
        setError(null);
      } catch (e: any) {
        setError(e?.response?.data?.message || 'Accès refusé ou erreur.');
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
          <ScrollText className="h-8 w-8 text-emerald-600" />
          Journal d’activité
        </h1>
        <p className="mt-1 font-medium text-slate-500">Historique des actions (admin).</p>
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-[2rem] border border-slate-200/60 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 sm:px-6">Date</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 sm:px-6">Utilisateur</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 sm:px-6">Action</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 sm:px-6">Entité</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 sm:px-6">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-slate-400">
                    Chargement…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-slate-400">
                    Aucune entrée.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-4 text-sm text-slate-600 sm:px-6">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString('fr-FR') : '—'}
                    </td>
                    <td className="px-4 py-4 text-sm font-bold text-slate-800 sm:px-6">{r.userName || '—'}</td>
                    <td className="px-4 py-4 text-sm font-medium text-slate-700 sm:px-6">{r.action}</td>
                    <td className="px-4 py-4 text-sm text-slate-600 sm:px-6">
                      {r.entityType}
                      {r.entityId != null ? ` #${r.entityId}` : ''}
                    </td>
                    <td className="max-w-xs truncate px-4 py-4 font-mono text-xs text-slate-500 sm:px-6">{r.details || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ActivityLog;
