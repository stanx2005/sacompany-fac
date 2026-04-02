import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownLeft,
  DollarSign,
  Package,
  Users,
  Calendar,
  FileText,
  Calculator,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalSales: 0,
    totalPurchases: 0,
    pendingIncoming: 0,
    pendingOutgoing: 0,
    totalQuotes: 0,
    chartData: [] as any[],
    purchaseChartData: [] as any[],
    kpi: {
      unpaidReceivables: 0,
      paidByCashTotal: 0,
      paidByChequeIncomingTotal: 0,
      topClients: [] as { clientName: string | null; totalSales: number }[],
    },
  });
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month' | 'year'>('day');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/stats');
        setStats({
          totalSales: Number(response.data.totalSales || 0),
          totalPurchases: Number(response.data.totalPurchases || 0),
          pendingIncoming: Number(response.data.pendingIncoming || 0),
          pendingOutgoing: Number(response.data.pendingOutgoing || 0),
          totalQuotes: Number(response.data.totalQuotes || 0),
          chartData: response.data.chartData || [],
          purchaseChartData: response.data.purchaseChartData || [],
          kpi: {
            unpaidReceivables: Number(response.data.kpi?.unpaidReceivables || 0),
            paidByCashTotal: Number(response.data.kpi?.paidByCashTotal || 0),
            paidByChequeIncomingTotal: Number(response.data.kpi?.paidByChequeIncomingTotal || 0),
            topClients: response.data.kpi?.topClients || [],
          },
        });
      } catch (error) {
        console.error('Erreur:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const getProcessedData = () => {
    const combinedMap: any = {};
    (stats.chartData || []).forEach((item: any) => {
      combinedMap[item.date] = { date: item.date, sales: Number(item.sales || 0), purchases: 0 };
    });
    (stats.purchaseChartData || []).forEach((item: any) => {
      if (combinedMap[item.date]) {
        combinedMap[item.date].purchases = Number(item.purchases || 0);
      } else {
        combinedMap[item.date] = { date: item.date, sales: 0, purchases: Number(item.purchases || 0) };
      }
    });
    let data = Object.values(combinedMap).sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    if (timeframe === 'week') return data.slice(-7);
    if (timeframe === 'month') return data.slice(-30);
    return data.slice(-10);
  };

  const chartData = getProcessedData();

  const cards = [
    { title: 'Ventes Totales', value: stats.totalSales, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: '+12.5%' },
    { title: 'Achats Totaux', value: stats.totalPurchases, icon: TrendingDown, color: 'text-rose-600', bg: 'bg-rose-50', trend: '-2.4%' },
    { title: 'Chèques à Encaisser', value: stats.pendingIncoming, icon: ArrowDownLeft, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'Chèques à Payer', value: stats.pendingOutgoing, icon: ArrowUpRight, color: 'text-amber-600', bg: 'bg-amber-50' },
    { title: 'Total Devis', value: stats.totalQuotes, icon: FileText, color: 'text-slate-600', bg: 'bg-slate-50' }
  ];

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Tableau de Bord</h1>
          <p className="mt-1 font-medium text-slate-500">Gérez votre activité commerciale en temps réel.</p>
        </div>
        <div className="-mx-1 flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-slate-200/60 bg-slate-100 p-1 sm:mx-0 sm:w-fit sm:flex-wrap sm:overflow-visible">
          {(['day', 'week', 'month', 'year'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTimeframe(t)}
              className={`shrink-0 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all sm:px-5 sm:text-xs ${
                timeframe === t 
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {t === 'day' ? 'Jour' : t === 'week' ? 'Semaine' : t === 'month' ? 'Mois' : 'Année'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-5">
        {cards.map((card, index) => (
          <div key={index} className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-24 h-24 ${card.bg} opacity-20 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110 duration-500`}></div>
            <div className="relative z-10">
              <div className={`w-12 h-12 rounded-2xl ${card.bg} flex items-center justify-center mb-6 transition-transform group-hover:rotate-6`}>
                <card.icon className={`w-6 h-6 ${card.color}`} />
              </div>
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-1">{card.title}</h3>
              <p className="text-xl font-black text-slate-900 tracking-tight">
                {loading ? '...' : `${card.value.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD`}
              </p>
              {card.trend && (
                <div className="mt-3 flex items-center space-x-1">
                  <span className={`text-[10px] font-bold ${card.trend.startsWith('+') ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {card.trend}
                  </span>
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">vs mois dernier</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-[2rem] border border-rose-200/60 bg-rose-50/40 p-6 shadow-sm">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-rose-600">Créances ouvertes</h3>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {loading ? '…' : `${stats.kpi.unpaidReceivables.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD`}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500">Reste à encaisser (factures non archivées)</p>
        </div>
        <div className="rounded-[2rem] border border-emerald-200/60 bg-emerald-50/40 p-6 shadow-sm">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-emerald-700">Encaissements espèces</h3>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {loading ? '…' : `${stats.kpi.paidByCashTotal.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD`}
          </p>
        </div>
        <div className="rounded-[2rem] border border-blue-200/60 bg-blue-50/40 p-6 shadow-sm">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-blue-700">Chèques entrants (total)</h3>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {loading ? '…' : `${stats.kpi.paidByChequeIncomingTotal.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD`}
          </p>
        </div>
      </div>

      {stats.kpi.topClients.length > 0 && (
        <div className="rounded-[2rem] border border-slate-200/60 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-400">Top clients (CA)</h3>
          <ul className="space-y-2">
            {stats.kpi.topClients.map((c, i) => (
              <li key={i} className="flex justify-between text-sm font-bold text-slate-800">
                <span>{c.clientName || '—'}</span>
                <span className="font-mono text-emerald-700">
                  {c.totalSales.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/60 bg-white p-4 shadow-sm sm:rounded-[2.5rem] sm:p-8 lg:col-span-2">
          <div className="relative z-10 mb-6 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-lg font-black tracking-tight text-slate-900 sm:text-xl">Analyse des Flux</h3>
              <p className="text-sm font-medium text-slate-400">Comparaison Ventes vs Achats</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-sm shadow-emerald-200"></div>
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Ventes</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-rose-400 rounded-full shadow-sm shadow-rose-200"></div>
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Achats</span>
              </div>
            </div>
          </div>
          
          <div className="relative z-10 h-[240px] w-full min-w-0 sm:h-[300px] lg:h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPurchases" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fb7185" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#fb7185" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10, fontWeight: '800'}}
                  dy={15}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10, fontWeight: '800'}}
                  tickFormatter={(value) => `${value}`}
                />
                <Tooltip 
                  cursor={{ stroke: '#e2e8f0', strokeWidth: 2 }}
                  contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '15px'}}
                  itemStyle={{fontSize: '12px', fontWeight: '900', textTransform: 'uppercase'}}
                />
                <Area type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
                <Area type="monotone" dataKey="purchases" stroke="#fb7185" strokeWidth={4} fillOpacity={1} fill="url(#colorPurchases)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl shadow-slate-200 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700"></div>
            <div className="relative z-10">
              <h3 className="text-xl font-black text-white tracking-tight mb-2">Actions Rapides</h3>
              <p className="text-slate-400 text-sm font-medium mb-8">Accédez aux outils essentiels</p>
              
              <div className="grid grid-cols-1 gap-3">
                {[
                  { label: 'Nouvelle Facture', icon: DollarSign, color: 'bg-emerald-500', path: '/invoices' },
                  { label: 'Ajouter au Carnet', icon: Package, color: 'bg-blue-500', path: '/tabs' },
                  { label: 'Nouveau Client', icon: Users, color: 'bg-amber-500', path: '/clients' }
                ].map((action, idx) => (
                  <button key={idx} className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all group/btn border border-white/5">
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 ${action.color} rounded-xl flex items-center justify-center shadow-lg`}>
                        <action.icon className="w-5 h-5 text-white" />
                      </div>
                      <span className="font-bold text-white text-sm">{action.label}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover/btn:text-white transition-colors transform group-hover/btn:translate-x-1" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-emerald-600 p-8 rounded-[2.5rem] shadow-lg shadow-emerald-100 relative overflow-hidden group">
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mb-16 transition-transform group-hover:scale-150 duration-700"></div>
            <div className="relative z-10 text-white">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-black tracking-tight mb-1">Système Sécurisé</h3>
              <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest leading-relaxed">
                Toutes vos données sont cryptées et sauvegardées localement.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Missing import fix
const ShieldCheck = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>
);

export default Dashboard;
