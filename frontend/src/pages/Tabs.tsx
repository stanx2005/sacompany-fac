import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { Plus, CheckCircle, Calendar, User, Package, X, Edit2, Trash2, Calculator, BookOpen, FileDown, History, Eye, Download } from 'lucide-react';
import {
  generatePDFSaveAndBase64,
  generatePDFAsBase64,
  openPdfBase64InNewTab,
  downloadPdfFromBase64,
} from '../utils/pdfGenerator';
import {
  loadCarnetPdfHistory,
  appendCarnetPdfEntry,
  getExportedItemIdsForClient,
  type CarnetPdfHistoryEntry,
  type CarnetPdfHistoryStore,
} from '../utils/carnetPdfHistory';

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

function groupTabItemsByDate(items: TabItem[]): [string, TabItem[]][] {
  const map = new Map<string, TabItem[]>();
  for (const item of items) {
    const d = item.date || '';
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(item);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

const Tabs = () => {
  const CREATE_CLIENT_OPTION = '__create_client__';
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TabItem | null>(null);

  const [formData, setFormData] = useState({
    clientId: '',
    productId: '',
    quantity: '1',
    date: new Date().toISOString().split('T')[0]
  });
  const [editForm, setEditForm] = useState({
    productId: '',
    quantity: '1',
    date: '',
  });
  const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [newClientData, setNewClientData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    taxNumber: '',
  });

  const [pdfHistoryStore, setPdfHistoryStore] = useState<CarnetPdfHistoryStore>(() => loadCarnetPdfHistory());
  const [pdfPicker, setPdfPicker] = useState<{ clientId: number; name: string; items: TabItem[] } | null>(null);
  const [selectedPdfItemIds, setSelectedPdfItemIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    setPdfHistoryStore(loadCarnetPdfHistory());
  }, []);

  const pdfPickerByDate = useMemo(
    () => (pdfPicker ? groupTabItemsByDate(pdfPicker.items) : []),
    [pdfPicker]
  );

  const openPdfPicker = (clientId: number, name: string, items: TabItem[]) => {
    setPdfPicker({ clientId, name, items });
    setSelectedPdfItemIds(new Set(items.map((i) => i.id)));
  };

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

  const openEditItem = (item: TabItem) => {
    setEditForm({
      productId: String(item.productId),
      quantity: String(item.quantity),
      date: item.date,
    });
    setEditingItem(item);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      await api.patch(`/tabs/${editingItem.id}`, {
        productId: parseInt(editForm.productId, 10),
        quantity: parseInt(editForm.quantity, 10),
        date: editForm.date,
      });
      setEditingItem(null);
      fetchData();
    } catch (error) {
      console.error('Erreur:', error);
      alert('Impossible de mettre à jour la ligne.');
    }
  };

  /** PDF stocké, ou régénéré à partir des lignes encore présentes dans le carnet. */
  const getHistoryPdfPayload = async (
    h: CarnetPdfHistoryEntry
  ): Promise<{ base64: string; filename: string } | null> => {
    if (h.pdfBase64 && h.pdfFilename) {
      return { base64: h.pdfBase64, filename: h.pdfFilename };
    }
    const idOrder = new Map(h.itemIds.map((id, idx) => [id, idx]));
    let lines = tabs.filter((t) => t.clientId === h.clientId && h.itemIds.includes(t.id));
    lines = [...lines].sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
    if (lines.length === 0) {
      alert(
        'Aucune ligne de ce BON ne figure plus dans le carnet. Impossible de rouvrir ce PDF tant que les lignes ne sont pas là (ou regénérez un nouveau BON).'
      );
      return null;
    }
    if (lines.length < h.itemIds.length) {
      const ok = window.confirm(
        `${h.itemIds.length - lines.length} ligne(s) ne sont plus dans le carnet. Le PDF sera régénéré avec les lignes restantes (le contenu peut différer). Continuer ?`
      );
      if (!ok) return null;
    }
    try {
      const client = clients.find((c) => c.id === h.clientId);
      const settingsRes = await api.get('/settings').catch(() => ({ data: {} }));
      const pb = settingsRes.data?.pdfBranding || {};
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const docDate = h.createdAt.slice(0, 10);
      const pdfData = { date: docDate, noteNumber: h.noteNumber };
      const pdfItems = lines.map((item: TabItem) => ({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.productPrice,
        taxRate: item.productTaxRate || 20,
        date: item.date,
      }));
      const entity = {
        name: client?.name || lines[0]?.clientName || 'Client',
        taxNumber: client?.taxNumber || '',
        address: client?.address || '',
        phone: client?.phone || '',
      };
      return generatePDFAsBase64('BON', pdfData, pdfItems, entity, { ...user, ...pb });
    } catch (e) {
      console.error(e);
      alert('Impossible de régénérer le PDF.');
      return null;
    }
  };

  const handleGenerateBonFromSelection = async () => {
    if (!pdfPicker) return;
    const { clientId, name, items } = pdfPicker;
    const selectedItems = items.filter((i) => selectedPdfItemIds.has(i.id));
    if (selectedItems.length === 0) {
      alert('Sélectionnez au moins une ligne à inclure dans le PDF.');
      return;
    }
    try {
      const client = clients.find((c) => c.id === clientId);
      const settingsRes = await api.get('/settings').catch(() => ({ data: {} }));
      const pb = settingsRes.data?.pdfBranding || {};
      const bonPrefix = settingsRes.data?.numbering?.bonTab ?? 'BON-TAB-';
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const noteNumber = `${bonPrefix}${clientId}-${Date.now().toString().slice(-4)}`;
      const pdfData = {
        date: new Date().toISOString().split('T')[0],
        noteNumber,
      };
      const pdfItems = selectedItems.map((item: TabItem) => ({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.productPrice,
        taxRate: item.productTaxRate || 20,
        date: item.date,
      }));
      const entity = {
        name: client?.name || name || 'Client',
        taxNumber: client?.taxNumber || '',
        address: client?.address || '',
        phone: client?.phone || '',
      };
      const { filename: pdfFilename, base64: pdfBase64 } = generatePDFSaveAndBase64(
        'BON',
        pdfData,
        pdfItems,
        entity,
        { ...user, ...pb }
      );

      const entry: CarnetPdfHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        clientId,
        createdAt: new Date().toISOString(),
        noteNumber,
        itemIds: selectedItems.map((i) => i.id),
        pdfBase64,
        pdfFilename,
      };
      setPdfHistoryStore((prev) => appendCarnetPdfEntry(prev, clientId, entry));
      setPdfPicker(null);
    } catch (error) {
      console.error('Erreur generation BON:', error);
      alert('Erreur lors de la generation du BON.');
    }
  };

  const togglePdfItem = (id: number) => {
    setSelectedPdfItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePdfDateGroup = (dateItems: TabItem[], selectAll: boolean) => {
    setSelectedPdfItemIds((prev) => {
      const next = new Set(prev);
      for (const it of dateItems) {
        if (selectAll) next.add(it.id);
        else next.delete(it.id);
      }
      return next;
    });
  };

  const allPdfPickerSelected =
    pdfPicker && pdfPicker.items.length > 0 && pdfPicker.items.every((i) => selectedPdfItemIds.has(i.id));

  const openCreateClientModal = () => {
    setNewClientData({ name: '', email: '', phone: '', address: '', taxNumber: '' });
    setIsCreateClientOpen(true);
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreatingClient(true);
      await api.post('/clients', newClientData);
      const clientsRes = await api.get('/clients');
      const allClients = clientsRes.data || [];
      setClients(allClients);
      const createdClient = allClients[allClients.length - 1];
      if (createdClient?.id) {
        setFormData((prev) => ({ ...prev, clientId: String(createdClient.id) }));
      }
      setIsCreateClientOpen(false);
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Erreur lors de la creation du client.');
    } finally {
      setCreatingClient(false);
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
          Object.entries(groupedTabs).map(([clientId, data]: [string, any]) => {
            const cid = parseInt(clientId, 10);
            const exportedIds = getExportedItemIdsForClient(pdfHistoryStore, cid);
            const clientHistory = pdfHistoryStore[String(cid)] || [];
            return (
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
                  <button
                    type="button"
                    disabled={!data.items?.length}
                    onClick={() => openPdfPicker(cid, data.name, data.items as TabItem[])}
                    className="p-2 text-blue-600 hover:bg-white hover:shadow-sm rounded-xl transition-all disabled:opacity-40 disabled:pointer-events-none"
                    title="Télécharger BON PDF (choisir les lignes)"
                  >
                    <FileDown className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 p-6 space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar">
                {data.items.map((item: TabItem) => {
                  const onBon = exportedIds.has(item.id);
                  const rate = 1 + (item.productTaxRate || 20) / 100;
                  return (
                  <div
                    key={item.id}
                    className={`flex justify-between items-center group/item rounded-xl px-2 py-1.5 -mx-2 transition-colors ${
                      onBon ? 'bg-violet-50/90 border border-violet-200/80' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold truncate text-sm ${onBon ? 'text-violet-900' : 'text-slate-700'}`}>
                        {item.productName}
                        {onBon && (
                          <span className="ml-2 text-[9px] font-black uppercase tracking-wider text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded-md align-middle">
                            Sur un BON
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-black uppercase tracking-tighter flex items-center space-x-1 mt-1">
                        <Calendar className="w-3 h-3" />
                        <span>{item.date}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 ml-4">
                      <div className="text-right">
                        <div className={`font-black text-sm ${onBon ? 'text-violet-700' : 'text-orange-600'}`}>x{item.quantity}</div>
                        <div className="text-[10px] font-bold text-slate-400">{(item.quantity * item.productPrice * rate).toFixed(2)} MAD</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openEditItem(item)}
                        className="opacity-0 group-hover/item:opacity-100 p-1.5 text-slate-300 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                        title="Modifier"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteItem(item.id)}
                        className="opacity-0 group-hover/item:opacity-100 p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
                })}
              </div>

              {clientHistory.length > 0 && (
                <div className="px-6 pb-2 border-t border-slate-100/80 bg-slate-50/40">
                  <div className="flex items-center gap-2 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <History className="w-3.5 h-3.5 text-slate-400" />
                    Historique PDF ({clientHistory.length})
                  </div>
                  <ul className="max-h-[160px] overflow-y-auto custom-scrollbar space-y-2 pb-3">
                    {[...clientHistory].reverse().map((h) => {
                      const hasStoredFile = Boolean(h.pdfBase64 && h.pdfFilename);
                      return (
                      <li
                        key={h.id}
                        className="text-xs rounded-xl bg-white border border-slate-200/80 px-3 py-2 flex items-start justify-between gap-2"
                      >
                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                          <span className="font-bold text-slate-800 truncate">{h.noteNumber}</span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(h.createdAt).toLocaleString('fr-FR', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                            {' · '}
                            {h.itemIds.length} ligne{h.itemIds.length > 1 ? 's' : ''}
                            {!hasStoredFile && (
                              <span className="block text-amber-600/90 font-bold mt-0.5">
                                Fichier non gardé en mémoire — ouverture depuis le carnet si les lignes existent encore
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            title={
                              hasStoredFile
                                ? 'Voir le PDF'
                                : 'Voir le PDF (régénéré à partir des lignes du carnet)'
                            }
                            onClick={() => {
                              void (async () => {
                                const p = await getHistoryPdfPayload(h);
                                if (p) openPdfBase64InNewTab(p.base64);
                              })();
                            }}
                            className="p-2 rounded-lg text-slate-500 hover:bg-violet-50 hover:text-violet-700 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title={
                              hasStoredFile
                                ? 'Télécharger à nouveau'
                                : 'Télécharger (régénéré à partir des lignes du carnet)'
                            }
                            onClick={() => {
                              void (async () => {
                                const p = await getHistoryPdfPayload(h);
                                if (p) downloadPdfFromBase64(p.base64, p.filename);
                              })();
                            }}
                            className="p-2 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                      );
                    })}
                  </ul>
                </div>
              )}

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
            );
          })
        )}
      </div>

      {pdfPicker && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50/50 shrink-0">
              <div>
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <FileDown className="w-6 h-6 text-blue-600" />
                  BON PDF
                </h2>
                <p className="text-sm font-bold text-slate-500 mt-1">{pdfPicker.name}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                  Cochez les lignes à inclure (groupées par date)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPdfPicker(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 custom-scrollbar space-y-4">
              <div className="flex flex-wrap gap-2 px-2">
                <button
                  type="button"
                  onClick={() => setSelectedPdfItemIds(new Set(pdfPicker.items.map((i) => i.id)))}
                  className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
                >
                  Tout sélectionner
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPdfItemIds(new Set())}
                  className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
                >
                  Tout désélectionner
                </button>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer ml-auto">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={!!allPdfPickerSelected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPdfItemIds(new Set(pdfPicker.items.map((i) => i.id)));
                      } else {
                        setSelectedPdfItemIds(new Set());
                      }
                    }}
                  />
                  Toutes les lignes
                </label>
              </div>
              {pdfPickerByDate.map(([date, dateItems]) => {
                const allInDate = dateItems.every((i) => selectedPdfItemIds.has(i.id));
                const someInDate = dateItems.some((i) => selectedPdfItemIds.has(i.id));
                return (
                  <div key={date} className="rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={allInDate}
                        ref={(el) => {
                          if (el) el.indeterminate = !allInDate && someInDate;
                        }}
                        onChange={(e) => togglePdfDateGroup(dateItems, e.target.checked)}
                      />
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-black text-slate-800">{date || 'Sans date'}</span>
                      <span className="text-[10px] font-bold text-slate-400 ml-auto">
                        {dateItems.length} ligne{dateItems.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <ul className="divide-y divide-slate-100">
                      {dateItems.map((item) => (
                        <li key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/80">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                            checked={selectedPdfItemIds.has(item.id)}
                            onChange={() => togglePdfItem(item.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-slate-800 text-sm truncate">{item.productName}</div>
                            <div className="text-[10px] font-bold text-slate-400">
                              x{item.quantity} · {item.productPrice.toFixed(2)} MAD HT
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            <div className="p-6 border-t border-slate-100 bg-white shrink-0 flex flex-col gap-3">
              <p className="text-xs font-bold text-slate-500 text-center">
                {selectedPdfItemIds.size === 0
                  ? 'Aucune ligne sélectionnée'
                  : `${selectedPdfItemIds.size} ligne${selectedPdfItemIds.size > 1 ? 's' : ''} sélectionnée${selectedPdfItemIds.size > 1 ? 's' : ''}`}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPdfPicker(null)}
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => void handleGenerateBonFromSelection()}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 shadow-lg shadow-blue-100"
                >
                  Générer le PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === CREATE_CLIENT_OPTION) {
                      openCreateClientModal();
                      return;
                    }
                    setFormData({...formData, clientId: value});
                  }}
                >
                  <option value="">Sélectionner un client</option>
                  <option value={CREATE_CLIENT_OPTION}>+ Creer un client</option>
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
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-black text-slate-800 flex items-center space-x-2">
                <Edit2 className="w-6 h-6 text-orange-600" />
                <span>Modifier la ligne</span>
              </h2>
              <button type="button" onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-8 space-y-5">
              <p className="text-sm font-bold text-slate-600">
                Client : <span className="text-slate-900">{editingItem.clientName}</span>
              </p>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Produit</label>
                <select
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-bold text-slate-700"
                  value={editForm.productId}
                  onChange={(e) => setEditForm({ ...editForm, productId: e.target.value })}
                >
                  <option value="">Sélectionner un produit</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Quantité</label>
                  <input
                    type="number"
                    min={1}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-bold text-slate-700"
                    value={editForm.quantity}
                    onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Date</label>
                  <input
                    type="date"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-bold text-slate-700"
                    value={editForm.date}
                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  />
                </div>
              </div>
              <div className="pt-4 flex space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-orange-700 shadow-lg shadow-orange-100 transition-all"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCreateClientOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-black text-slate-800">Nouveau Client</h2>
              <button type="button" onClick={() => setIsCreateClientOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCreateClient} className="p-8 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Nom Complet</label>
                <input type="text" required className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-700" value={newClientData.name} onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Telephone</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-700" value={newClientData.phone} onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Matricule Fiscale</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-700" value={newClientData.taxNumber} onChange={(e) => setNewClientData({ ...newClientData, taxNumber: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Email</label>
                <input type="email" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-700" value={newClientData.email} onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Adresse</label>
                <textarea rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-700" value={newClientData.address} onChange={(e) => setNewClientData({ ...newClientData, address: e.target.value })} />
              </div>
              <div className="pt-4 flex space-x-3">
                <button type="button" onClick={() => setIsCreateClientOpen(false)} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all">Annuler</button>
                <button type="submit" disabled={creatingClient} className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all disabled:opacity-60">
                  {creatingClient ? 'Creation...' : 'Creer'}
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
