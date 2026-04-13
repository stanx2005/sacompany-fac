import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { generatePDF } from '../utils/pdfGenerator';
import { useAuthStore } from '../store/authStore';
import {
  Plus,
  Search,
  FileText,
  Calendar,
  Trash2,
  Eye,
  Download,
  Upload,
  X,
  Save,
  Archive,
  ShoppingCart,
  Edit2,
} from 'lucide-react';

interface PurchaseInvoiceRow {
  id: number;
  supplierId: number | null;
  supplierName: string | null;
  purchaseOrderId: number | null;
  purchaseOrderNumber: string | null;
  invoiceNumber: string;
  date: string;
  totalExclTax: number;
  totalTax: number;
  totalInclTax: number;
  sourceType: string;
  filePath: string | null;
  fileMime: string | null;
  originalFilename: string | null;
  notes: string | null;
  status: string | null;
  archived?: number | null;
}

type LineItem = { productId: string; quantity: number; unitPrice: number; taxRate: number };

const emptyLine = (): LineItem => ({ productId: '', quantity: 1, unitPrice: 0, taxRate: 20 });

const PurchaseInvoices = () => {
  const isAccountant = useAuthStore((s) => s.user?.role === 'accountant');
  const [rows, setRows] = useState<PurchaseInvoiceRow[]>([]);
  const [suppliers, setSuppliers] = useState<
    { id: number; name: string; taxNumber?: string; address?: string; phone?: string }[]
  >([]);
  const [products, setProducts] = useState<{ id: number; name: string; price: number; purchasePrice?: number; taxRate: number }[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<{ id: number; orderNumber: string; supplierName: string }[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [modalMode, setModalMode] = useState<'manual' | 'upload' | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<PurchaseInvoiceRow | null>(null);

  const [manualForm, setManualForm] = useState({
    supplierId: '',
    invoiceNumber: '',
    date: new Date().toISOString().split('T')[0],
    totalInclTax: '',
    taxRate: '20',
    notes: '',
    items: [emptyLine()] as LineItem[],
  });

  const [uploadForm, setUploadForm] = useState({
    supplierId: '',
    purchaseOrderId: '',
    invoiceNumber: '',
    date: new Date().toISOString().split('T')[0],
    totalInclTax: '',
    taxRate: '20',
    notes: '',
    file: null as File | null,
  });

  const manualTotals = useMemo(() => {
    let excl = 0;
    let incl = 0;
    for (const it of manualForm.items) {
      if (!it.productId) continue;
      const q = Number(it.quantity) || 0;
      const p = Number(it.unitPrice) || 0;
      const tr = Number(it.taxRate) ?? 20;
      const ht = q * p;
      excl += ht;
      incl += q * p * (1 + tr / 100);
    }
    return {
      totalExcl: Math.round(excl * 100) / 100,
      totalIncl: Math.round(incl * 100) / 100,
      hasLines: manualForm.items.some((i) => i.productId && Number(i.quantity) >= 1),
    };
  }, [manualForm.items]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [invRes, supRes, prodRes, poRes] = await Promise.all([
        api.get('/purchase-invoices', { params: { includeArchived: includeArchived ? '1' : undefined } }),
        api.get('/suppliers'),
        api.get('/products'),
        api.get('/purchase-orders', { params: { includeArchived: '1' } }),
      ]);
      setRows(invRes.data);
      setSuppliers(supRes.data);
      setProducts(prodRes.data);
      setPurchaseOrders(
        (poRes.data || []).map((o: any) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          supplierName: o.supplierName || '',
        }))
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [includeArchived]);

  const closeModal = () => {
    setModalMode(null);
    setEditingInvoice(null);
    setManualForm({
      supplierId: '',
      invoiceNumber: '',
      date: new Date().toISOString().split('T')[0],
      totalInclTax: '',
      taxRate: '20',
      notes: '',
      items: [emptyLine()],
    });
    setUploadForm({
      supplierId: '',
      purchaseOrderId: '',
      invoiceNumber: '',
      date: new Date().toISOString().split('T')[0],
      totalInclTax: '',
      taxRate: '20',
      notes: '',
      file: null,
    });
  };

  const handleManualItemChange = (index: number, field: keyof LineItem, value: string | number) => {
    const next = [...manualForm.items];
    if (field === 'productId') {
      const p = products.find((x) => x.id === parseInt(String(value), 10));
      next[index] = {
        ...next[index]!,
        productId: String(value),
        unitPrice: p ? Number(p.purchasePrice ?? p.price ?? 0) : next[index]!.unitPrice,
        taxRate: p ? p.taxRate : next[index]!.taxRate,
      };
    } else {
      (next[index] as any)[field] = value;
    }
    setManualForm({ ...manualForm, items: next });
  };

  const submitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAccountant) return;
    try {
      const validItems = manualForm.items.filter((i) => i.productId && Number(i.quantity) >= 1);
      if (validItems.length > 0) {
        const payload = {
          supplierId: manualForm.supplierId || null,
          invoiceNumber: manualForm.invoiceNumber.trim(),
          date: manualForm.date,
          notes: manualForm.notes || undefined,
          items: validItems.map((i) => ({
            productId: parseInt(i.productId, 10),
            quantity: Number(i.quantity),
            unitPrice: Number(i.unitPrice),
            taxRate: Number(i.taxRate ?? 20),
          })),
        };
        if (editingInvoice) {
          await api.put(`/purchase-invoices/${editingInvoice.id}`, payload);
        } else {
          await api.post('/purchase-invoices', payload);
        }
      } else {
        const ttc = parseFloat(manualForm.totalInclTax);
        if (Number.isNaN(ttc) || ttc < 0) {
          alert('Ajoutez des lignes produits ou un montant TTC.');
          return;
        }
        const payload = {
          supplierId: manualForm.supplierId || null,
          invoiceNumber: manualForm.invoiceNumber.trim(),
          date: manualForm.date,
          totalInclTax: ttc,
          taxRate: parseFloat(manualForm.taxRate || '20'),
          notes: manualForm.notes || undefined,
        };
        if (editingInvoice) {
          await api.put(`/purchase-invoices/${editingInvoice.id}`, payload);
        } else {
          await api.post('/purchase-invoices', payload);
        }
      }
      closeModal();
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erreur enregistrement.');
    }
  };

  const submitUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAccountant) return;
    if (!uploadForm.file) {
      alert('Choisissez un fichier PDF ou image.');
      return;
    }
    try {
      const fd = new FormData();
      fd.append('file', uploadForm.file);
      if (uploadForm.supplierId) fd.append('supplierId', uploadForm.supplierId);
      if (uploadForm.purchaseOrderId) fd.append('purchaseOrderId', uploadForm.purchaseOrderId);
      if (uploadForm.invoiceNumber.trim()) fd.append('invoiceNumber', uploadForm.invoiceNumber.trim());
      fd.append('date', uploadForm.date);
      if (uploadForm.totalInclTax.trim()) fd.append('totalInclTax', uploadForm.totalInclTax);
      fd.append('taxRate', uploadForm.taxRate || '20');
      if (uploadForm.notes.trim()) fd.append('notes', uploadForm.notes);

      await api.post('/purchase-invoices/upload', fd);
      closeModal();
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erreur import.');
    }
  };

  const fetchAttachmentBlob = async (id: number, disposition: 'inline' | 'attachment') => {
    const res = await api.get(`/purchase-invoices/${id}/attachment`, {
      responseType: 'blob',
      params: { disposition },
    });
    const type = res.headers['content-type'] || 'application/octet-stream';
    const blob = new Blob([res.data], { type });
    return { blob, type };
  };

  const handleViewFile = async (row: PurchaseInvoiceRow) => {
    if (!row.filePath) return;
    try {
      const { blob } = await fetchAttachmentBlob(row.id, 'inline');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch {
      alert('Impossible d’ouvrir le fichier.');
    }
  };

  const handleDownloadFile = async (row: PurchaseInvoiceRow) => {
    if (!row.filePath) return;
    try {
      const { blob } = await fetchAttachmentBlob(row.id, 'attachment');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = row.originalFilename || `facture-achat-${row.id}.pdf`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Impossible de télécharger le fichier.');
    }
  };

  /** Fichier joint si présent, sinon PDF généré (lignes ou montant global). */
  const handleDownloadPdf = async (row: PurchaseInvoiceRow) => {
    if (row.filePath) {
      await handleDownloadFile(row);
      return;
    }
    try {
      const [itemsRes, settingsRes] = await Promise.all([
        api.get(`/purchase-invoices/${row.id}/items`),
        api.get('/settings').catch(() => ({ data: {} })),
      ]);
      const raw = itemsRes.data as Array<{
        productName: string | null;
        quantity: number;
        unitPrice: number;
        taxRate: number;
      }>;

      let pdfItems = raw.map((it) => ({
        productName: it.productName || 'Produit',
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        taxRate: it.taxRate,
      }));

      if (pdfItems.length === 0) {
        const ttc = Number(row.totalInclTax) || 0;
        let ex = Number(row.totalExclTax) || 0;
        let tx = Number(row.totalTax) || 0;
        if (ex === 0 && tx === 0 && ttc > 0) {
          ex = Math.round((ttc / 1.2) * 100) / 100;
          tx = Math.round((ttc - ex) * 100) / 100;
        }
        const rate = ex > 0 ? Math.round((tx / ex) * 10000) / 100 : 20;
        pdfItems = [
          {
            productName: 'Montant global (sans lignes détaillées)',
            quantity: 1,
            unitPrice: ex,
            taxRate: rate,
          },
        ];
      }

      const sup = suppliers.find((s) => s.id === row.supplierId);
      const entity = {
        name: sup?.name || row.supplierName || 'Fournisseur',
        taxNumber: sup?.taxNumber || '',
        address: sup?.address || '',
        phone: sup?.phone || '',
      };

      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const pb = settingsRes.data?.pdfBranding || {};
      const pdfData = {
        date: row.date,
        invoiceNumber: row.invoiceNumber,
      };

      generatePDF('FACTURE ACHAT', pdfData, pdfItems, entity, { ...user, ...pb });
    } catch (e) {
      console.error(e);
      alert('Impossible de générer le PDF.');
    }
  };

  const handleDelete = async (id: number) => {
    if (isAccountant) return;
    if (!window.confirm('Supprimer définitivement cette facture achat ?')) return;
    try {
      await api.delete(`/purchase-invoices/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Suppression impossible.');
    }
  };

  const handleArchive = async (row: PurchaseInvoiceRow) => {
    if (isAccountant) return;
    const next = Number(row.archived) === 1 ? 0 : 1;
    try {
      await api.patch(`/purchase-invoices/${row.id}/archive`, { archived: next });
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Action impossible.');
    }
  };

  const openEditInvoice = async (row: PurchaseInvoiceRow) => {
    if (isAccountant) return;
    try {
      const itemsRes = await api.get(`/purchase-invoices/${row.id}/items`);
      const items = (itemsRes.data || []).map((item: any) => ({
        productId: String(item.productId || ''),
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice || 0),
        taxRate: Number(item.taxRate || 20),
      }));
      setEditingInvoice(row);
      setManualForm({
        supplierId: row.supplierId ? String(row.supplierId) : '',
        invoiceNumber: row.invoiceNumber || '',
        date: row.date || new Date().toISOString().split('T')[0],
        totalInclTax: row.totalInclTax != null ? String(row.totalInclTax) : '',
        taxRate: '20',
        notes: row.notes || '',
        items: items.length ? items : [emptyLine()],
      });
      setModalMode('manual');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Impossible de charger la facture.');
    }
  };

  const sourceLabel = (t: string) => {
    if (t === 'upload') return 'Fichier';
    if (t === 'from_order') return 'Depuis BC';
    return 'Saisie';
  };

  const filtered = rows
    .filter(
      (r) =>
        r.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.supplierName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.purchaseOrderNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => b.id - a.id);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Factures achat</h1>
          <p className="mt-1 font-medium text-slate-500">
            Saisie avec lignes produits, import PDF/image, lien optionnel vers un bon de commande.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (!isAccountant) {
                setEditingInvoice(null);
                setModalMode('manual');
              }
            }}
            disabled={isAccountant}
            className="flex items-center gap-2 rounded-2xl bg-rose-600 px-5 py-2.5 font-bold text-white shadow-lg shadow-rose-100 transition-all hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-5 w-5" />
            Nouvelle facture
          </button>
          <button
            type="button"
            onClick={() => {
              if (!isAccountant) setModalMode('upload');
            }}
            disabled={isAccountant}
            className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-white px-5 py-2.5 font-bold text-rose-700 shadow-sm transition-all hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="h-5 w-5" />
            Importer PDF / image
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[2.5rem] border border-slate-200/60 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/30 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-md flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher (n°, fournisseur, BC)…"
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-rose-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-600">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            Afficher archivées
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-4 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">N°</th>
                <th className="px-4 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Date</th>
                <th className="px-4 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Fournisseur</th>
                <th className="px-4 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">BC lié</th>
                <th className="px-4 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Source</th>
                <th className="px-4 py-4 text-right text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                  TTC
                </th>
                <th className="px-4 py-4 text-right text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center font-medium text-slate-400">
                    Chargement…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center font-medium text-slate-400">
                    Aucune facture achat.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.id}
                    className={`transition-colors hover:bg-slate-50/50 ${r.archived ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-5">
                      <div className="flex flex-wrap items-center gap-2 font-bold text-slate-900">
                        <FileText className="h-4 w-4 shrink-0 text-rose-500" />
                        {r.invoiceNumber}
                        {r.archived ? (
                          <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-600">
                            Archivée
                          </span>
                        ) : null}
                      </div>
                      {r.notes && (
                        <p className="mt-1 max-w-xs truncate text-xs text-slate-400">{r.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-5">
                      <span className="flex items-center gap-1 text-sm font-bold text-slate-600">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        {r.date}
                      </span>
                    </td>
                    <td className="px-4 py-5 text-sm font-bold text-slate-700">
                      {r.supplierName || <span className="font-medium text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-5 text-xs font-bold text-slate-600">
                      {r.purchaseOrderNumber ? (
                        <span className="flex items-center gap-1 text-emerald-700">
                          <ShoppingCart className="h-3.5 w-3.5" />
                          {r.purchaseOrderNumber}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-5">
                      <span
                        className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
                          r.sourceType === 'upload'
                            ? 'bg-violet-50 text-violet-700'
                            : r.sourceType === 'from_order'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {sourceLabel(r.sourceType)}
                      </span>
                    </td>
                    <td className="px-4 py-5 text-right font-mono font-bold text-slate-900">
                      {Number(r.totalInclTax).toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                    </td>
                    <td className="px-4 py-5 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-0.5">
                        {r.filePath && (
                          <button
                            type="button"
                            title="Voir le fichier"
                            onClick={() => void handleViewFile(r)}
                            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-violet-50 hover:text-violet-700"
                          >
                            <Eye className="h-5 w-5" />
                          </button>
                        )}
                        <button
                          type="button"
                          title="Modifier"
                          onClick={() => void openEditInvoice(r)}
                          className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Edit2 className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          title={
                            r.filePath ? 'Télécharger le fichier' : 'Télécharger le PDF (généré)'
                          }
                          onClick={() => void handleDownloadPdf(r)}
                          className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Download className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          title={r.archived ? 'Restaurer' : 'Archiver'}
                          onClick={() => void handleArchive(r)}
                          className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-700"
                        >
                          <Archive className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          title="Supprimer"
                          onClick={() => void handleDelete(r.id)}
                          className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-5 w-5" />
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

      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div
            className={`max-h-[90vh] w-full overflow-y-auto rounded-[2rem] bg-white shadow-2xl ${
              modalMode === 'manual' ? 'max-w-3xl' : 'max-w-lg'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-6">
              <h2 className="text-xl font-black text-slate-800">
                {modalMode === 'manual'
                  ? editingInvoice
                    ? `Modifier ${editingInvoice.invoiceNumber}`
                    : 'Nouvelle facture (saisie)'
                  : 'Importer PDF ou image'}
              </h2>
              <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            {modalMode === 'manual' ? (
              <form onSubmit={submitManual} className="space-y-4 p-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Fournisseur (optionnel)
                    </label>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-700 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-rose-500"
                      value={manualForm.supplierId}
                      onChange={(e) => setManualForm({ ...manualForm, supplierId: e.target.value })}
                    >
                      <option value="">—</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      N° facture fournisseur
                    </label>
                    <input
                      required
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-rose-500"
                      value={manualForm.invoiceNumber}
                      onChange={(e) => setManualForm({ ...manualForm, invoiceNumber: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-rose-500 sm:max-w-xs"
                    value={manualForm.date}
                    onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                  />
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-800">Lignes produits (optionnel)</h3>
                    <button
                      type="button"
                      onClick={() =>
                        setManualForm({ ...manualForm, items: [...manualForm.items, emptyLine()] })
                      }
                      className="flex items-center gap-1 rounded-xl bg-rose-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-rose-700"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Ligne
                    </button>
                  </div>
                  <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
                    {manualForm.items.map((item, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-12 items-end gap-2 rounded-2xl border border-slate-100 bg-slate-50/80 p-3"
                      >
                        <div className="col-span-12 sm:col-span-5">
                          <label className="mb-1 block text-[9px] font-black uppercase text-slate-400">
                            Produit
                          </label>
                          <select
                            className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm font-bold"
                            value={item.productId}
                            onChange={(e) => handleManualItemChange(index, 'productId', e.target.value)}
                          >
                            <option value="">—</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-4 sm:col-span-2">
                          <label className="mb-1 block text-[9px] font-black uppercase text-slate-400">Qté</label>
                          <input
                            type="number"
                            min={1}
                            className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm font-bold"
                            value={item.quantity}
                            onChange={(e) =>
                              handleManualItemChange(index, 'quantity', parseInt(e.target.value, 10) || 1)
                            }
                          />
                        </div>
                        <div className="col-span-4 sm:col-span-2">
                          <label className="mb-1 block text-[9px] font-black uppercase text-slate-400">
                            Prix HT
                          </label>
                          <input
                            type="number"
                            step={0.01}
                            className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm font-bold"
                            value={item.unitPrice}
                            onChange={(e) =>
                              handleManualItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                        <div className="col-span-3 sm:col-span-2">
                          <label className="mb-1 block text-[9px] font-black uppercase text-slate-400">TVA %</label>
                          <input
                            type="number"
                            step={0.01}
                            className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm font-bold"
                            value={item.taxRate}
                            onChange={(e) =>
                              handleManualItemChange(index, 'taxRate', parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                        <div className="col-span-1 flex justify-end sm:col-span-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (manualForm.items.length <= 1) {
                                setManualForm({ ...manualForm, items: [emptyLine()] });
                              } else {
                                setManualForm({
                                  ...manualForm,
                                  items: manualForm.items.filter((_, i) => i !== index),
                                });
                              }
                            }}
                            className="p-2 text-slate-300 hover:text-rose-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {manualTotals.hasLines && (
                    <p className="mt-2 text-right text-xs font-bold text-slate-600">
                      Total TTC calculé :{' '}
                      <span className="font-mono text-rose-700">
                        {manualTotals.totalIncl.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                      </span>
                    </p>
                  )}
                </div>

                {!manualTotals.hasLines && (
                  <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                    <div>
                      <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Montant TTC (sans lignes)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-rose-500"
                        value={manualForm.totalInclTax}
                        onChange={(e) => setManualForm({ ...manualForm, totalInclTax: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        TVA % (pour décomposer HT/TVA)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-rose-500"
                        value={manualForm.taxRate}
                        onChange={(e) => setManualForm({ ...manualForm, taxRate: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    Notes (optionnel)
                  </label>
                  <textarea
                    rows={2}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-rose-500"
                    value={manualForm.notes}
                    onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 rounded-2xl border border-slate-200 py-3 font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-600 py-3 font-bold text-white shadow-lg shadow-rose-100 hover:bg-rose-700"
                  >
                    <Save className="h-4 w-4" />
                    {editingInvoice ? 'Enregistrer les modifications' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={submitUpload} className="space-y-4 p-6">
                <div>
                  <label
                    htmlFor="purchase-inv-file"
                    className="mb-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50/40 px-4 py-10 transition-colors hover:bg-rose-50"
                  >
                    <Upload className="mb-2 h-10 w-10 text-rose-400" />
                    <span className="text-sm font-bold text-rose-800">PDF, PNG, JPG, WEBP, GIF</span>
                    <span className="mt-1 text-xs text-slate-500">max. 15 Mo — cliquez pour choisir</span>
                  </label>
                  <input
                    id="purchase-inv-file"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,application/pdf,image/*"
                    className="sr-only"
                    onChange={(e) =>
                      setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })
                    }
                  />
                  {uploadForm.file && (
                    <p className="mt-2 text-center text-xs font-bold text-slate-600">{uploadForm.file.name}</p>
                  )}
                </div>
                <div>
                  <label className="mb-2 ml-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <ShoppingCart className="h-3.5 w-3.5" />
                    Lier à un bon de commande (optionnel)
                  </label>
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-rose-500"
                    value={uploadForm.purchaseOrderId}
                    onChange={(e) => setUploadForm({ ...uploadForm, purchaseOrderId: e.target.value })}
                  >
                    <option value="">— Aucun —</option>
                    {purchaseOrders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.orderNumber} — {o.supplierName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    Fournisseur (optionnel)
                  </label>
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-rose-500"
                    value={uploadForm.supplierId}
                    onChange={(e) => setUploadForm({ ...uploadForm, supplierId: e.target.value })}
                  >
                    <option value="">—</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    N° facture (optionnel — sinon auto)
                  </label>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-rose-500"
                    value={uploadForm.invoiceNumber}
                    onChange={(e) => setUploadForm({ ...uploadForm, invoiceNumber: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Date
                    </label>
                    <input
                      type="date"
                      required
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-rose-500"
                      value={uploadForm.date}
                      onChange={(e) => setUploadForm({ ...uploadForm, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Montant TTC (optionnel)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-rose-500"
                      value={uploadForm.totalInclTax}
                      onChange={(e) => setUploadForm({ ...uploadForm, totalInclTax: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    Notes (optionnel)
                  </label>
                  <textarea
                    rows={2}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-rose-500"
                    value={uploadForm.notes}
                    onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 rounded-2xl border border-slate-200 py-3 font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-600 py-3 font-bold text-white shadow-lg shadow-rose-100 hover:bg-rose-700"
                  >
                    <Upload className="h-4 w-4" />
                    Importer
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseInvoices;
