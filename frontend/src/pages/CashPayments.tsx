import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Wallet, Calendar, Save, X } from 'lucide-react';
import api from '../services/api';

interface InvoiceRow {
  id: number;
  invoiceNumber: string;
  clientId: number;
  clientName: string;
  totalInclTax: number;
  paidCash?: number;
  paidCheque?: number;
  totalPaid?: number;
  remaining?: number;
}

interface CashPaymentRow {
  id: number;
  paymentNumber: string;
  amount: number;
  paymentDate: string;
  note: string | null;
  invoiceId: number;
  invoiceNumber: string | null;
  clientName: string | null;
}

const CashPayments = () => {
  const [payments, setPayments] = useState<CashPaymentRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    invoiceId: '',
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    note: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [paymentsRes, invoicesRes] = await Promise.all([
        api.get('/cash-payments'),
        api.get('/invoices'),
      ]);
      setPayments(paymentsRes.data || []);
      setInvoices(invoicesRes.data || []);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const selectedInvoice = useMemo(
    () => invoices.find((i) => i.id === Number(form.invoiceId)),
    [form.invoiceId, invoices]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    try {
      await api.post('/cash-payments', {
        invoiceId: selectedInvoice.id,
        clientId: selectedInvoice.clientId,
        amount: Number(form.amount || 0),
        paymentDate: form.paymentDate,
        note: form.note || null,
      });
      setIsModalOpen(false);
      setForm({
        invoiceId: '',
        amount: '',
        paymentDate: new Date().toISOString().split('T')[0],
        note: '',
      });
      fetchData();
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Erreur lors de lenregistrement du paiement espece.');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Paiement en especes</h1>
          <p className="mt-1 font-medium text-slate-500">Ajoutez des paiements cash lies a une facture (optionnel).</p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex min-h-[44px] items-center space-x-2 rounded-2xl bg-emerald-600 px-6 py-2.5 font-bold text-white shadow-lg shadow-emerald-100 transition-all hover:bg-emerald-700"
        >
          <Plus className="h-5 w-5" />
          <span>Nouveau paiement cash</span>
        </button>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-slate-200/60 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/30 p-6">
          <h2 className="text-lg font-black text-slate-900 tracking-tight">Registre des paiements cash</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Ref</th>
                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Facture</th>
                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Client</th>
                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-right text-slate-400">Montant</th>
                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Date</th>
                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-16 text-center text-slate-400">Chargement...</td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-16 text-center text-slate-400">Aucun paiement cash enregistre.</td></tr>
              ) : (
                payments.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="px-6 py-5 font-black text-slate-700">{row.paymentNumber}</td>
                    <td className="px-6 py-5 font-bold text-slate-700">{row.invoiceNumber || '-'}</td>
                    <td className="px-6 py-5 font-medium text-slate-600">{row.clientName || '-'}</td>
                    <td className="px-6 py-5 text-right font-mono font-black text-slate-900">
                      {Number(row.amount || 0).toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                    </td>
                    <td className="px-6 py-5 text-sm font-medium text-slate-500">{row.paymentDate}</td>
                    <td className="px-6 py-5 text-sm text-slate-500">{row.note || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-[2rem] bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 p-6">
              <h2 className="flex items-center space-x-2 text-xl font-black text-slate-800">
                <Wallet className="h-6 w-6 text-emerald-600" />
                <span>Nouveau paiement en especes</span>
              </h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-8">
              <div>
                <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Facture</label>
                <select
                  required
                  value={form.invoiceId}
                  onChange={(e) => setForm({ ...form, invoiceId: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-700 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Selectionner une facture</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} - {inv.clientName}
                    </option>
                  ))}
                </select>
              </div>

              {selectedInvoice && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 text-sm font-bold text-slate-700">
                  <div className="flex items-center space-x-2 text-emerald-700">
                    <Calendar className="h-4 w-4" />
                    <span>{selectedInvoice.invoiceNumber} - {selectedInvoice.clientName}</span>
                  </div>
                  <div className="mt-2 text-xs font-black uppercase tracking-wider text-slate-500">
                    Total: {Number(selectedInvoice.totalInclTax || 0).toFixed(2)} MAD | Reste: {Number(selectedInvoice.remaining ?? selectedInvoice.totalInclTax ?? 0).toFixed(2)} MAD
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Montant</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-700 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Date de paiement</label>
                  <input
                    type="date"
                    required
                    value={form.paymentDate}
                    onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-700 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Note (optionnel)</label>
                <textarea
                  rows={3}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-700 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex space-x-4 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex flex-1 items-center justify-center space-x-2 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-100 transition-all hover:bg-emerald-700"
                >
                  <Save className="h-4 w-4" />
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

export default CashPayments;
