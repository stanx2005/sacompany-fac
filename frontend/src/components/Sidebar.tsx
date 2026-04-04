import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Truck, 
  Package, 
  FileText, 
  BookOpen, 
  CreditCard, 
  Wallet,
  LogOut,
  ShoppingCart,
  ShoppingBag,
  ClipboardList,
  UserCircle,
  ChevronRight,
  X,
  Settings,
  ScrollText,
  Bell,
  Receipt,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

type SidebarProps = {
  mobileOpen?: boolean;
  onClose?: () => void;
};

const Sidebar = ({ mobileOpen = false, onClose }: SidebarProps) => {
  const logout = useAuthStore((state) => state.logout);
  const role = useAuthStore((state) => state.user?.role);

  const menuItems = [
    { group: 'Général', items: [
      { icon: LayoutDashboard, label: 'Tableau de bord', path: '/' },
      { icon: Bell, label: 'Rappels', path: '/reminders' },
    ]},
    { group: 'Ventes', items: [
      { icon: Users, label: 'Clients', path: '/clients' },
      { icon: FileText, label: 'Devis', path: '/quotes' },
      { icon: ClipboardList, label: 'Bon de Livraison', path: '/delivery-notes' },
      { icon: FileText, label: 'Factures', path: '/invoices' },
      { icon: BookOpen, label: 'Carnet (Tabs)', path: '/tabs' },
      { icon: Package, label: 'Produits', path: '/products' },
    ]},
    { group: 'Achats', items: [
      { icon: Truck, label: 'Fournisseurs', path: '/suppliers' },
      { icon: ShoppingCart, label: 'Bon de Commande', path: '/purchase-orders' },
      { icon: Receipt, label: 'Facture', path: '/purchase-invoices' },
      { icon: ShoppingBag, label: 'Produit Achat', path: '/purchase-products' },
    ]},
    { group: 'Finance', items: [
      { icon: CreditCard, label: 'Chèques', path: '/cheques' },
      { icon: Wallet, label: 'Paiement en especes', path: '/cash-payments' },
    ]},
    { group: 'Compte', items: [
      { icon: UserCircle, label: 'Mon Profil', path: '/profile' },
      { icon: Settings, label: 'Paramètres', path: '/settings' },
      ...(role === 'admin' ? [{ icon: ScrollText, label: "Journal d'activité", path: '/activity' }] : []),
    ]}
  ];

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[min(18rem,85vw)] max-w-[100vw] flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-72 lg:max-w-none lg:shadow-none ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}
    >
      <div className="p-5 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center space-x-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 shadow-lg shadow-emerald-100">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-black leading-none text-slate-900 sm:text-lg">SA-COMPANY</h1>
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">B2B System</span>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fermer le menu"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 lg:hidden"
            onClick={() => onClose?.()}
          >
            <X className="h-5 w-5" strokeWidth={2.25} />
          </button>
        </div>
      </div>

      <nav className="custom-scrollbar flex-1 overflow-y-auto px-3 pb-8 sm:px-4">
        {menuItems.map((group, idx) => (
          <div key={idx} className="mb-8">
            <h3 className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
              {group.group}
            </h3>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => onClose?.()}
                  className={({ isActive }) =>
                    `group flex min-h-[44px] items-center justify-between rounded-xl px-4 py-3 transition-all active:scale-[0.99] ${
                      isActive 
                        ? 'bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-50/50' 
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  <div className="flex items-center space-x-3">
                    <item.icon className={`w-5 h-5 transition-colors ${
                      /* isActive handled by parent template literal */ ''
                    }`} />
                    <span className="text-sm font-bold tracking-tight">{item.label}</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-4px] group-hover:translate-x-0`} />
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-100 bg-slate-50/50 p-3 sm:p-4">
        <button
          type="button"
          onClick={() => {
            onClose?.();
            logout();
          }}
          className="flex min-h-[44px] w-full items-center space-x-3 rounded-xl px-4 py-3 text-sm font-bold text-slate-500 transition-all hover:bg-red-50 hover:text-red-600 active:scale-[0.99]"
        >
          <LogOut className="w-5 h-5" />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
