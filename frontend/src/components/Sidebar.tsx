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
  LogOut,
  ShoppingCart,
  ClipboardList,
  UserCircle,
  ChevronRight
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const Sidebar = () => {
  const logout = useAuthStore((state) => state.logout);

  const menuItems = [
    { group: 'Général', items: [
      { icon: LayoutDashboard, label: 'Tableau de bord', path: '/' },
    ]},
    { group: 'Ventes', items: [
      { icon: Users, label: 'Clients', path: '/clients' },
      { icon: FileText, label: 'Devis', path: '/quotes' },
      { icon: ClipboardList, label: 'Bon de Livraison', path: '/delivery-notes' },
      { icon: FileText, label: 'Factures', path: '/invoices' },
      { icon: BookOpen, label: 'Carnet (Tabs)', path: '/tabs' },
    ]},
    { group: 'Achats', items: [
      { icon: Truck, label: 'Fournisseurs', path: '/suppliers' },
      { icon: ShoppingCart, label: 'Bon de Commande', path: '/purchase-orders' },
      { icon: Package, label: 'Produits', path: '/products' },
    ]},
    { group: 'Finance', items: [
      { icon: CreditCard, label: 'Chèques', path: '/cheques' },
    ]},
    { group: 'Compte', items: [
      { icon: UserCircle, label: 'Mon Profil', path: '/profile' },
    ]}
  ];

  return (
    <div className="w-72 bg-white h-screen border-r border-slate-200 flex flex-col sticky top-0">
      <div className="p-8">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-100">
            <Package className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 leading-none">SA COMPANY</h1>
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">B2B System</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 overflow-y-auto custom-scrollbar pb-8">
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
                  className={({ isActive }) =>
                    `flex items-center justify-between px-4 py-3 rounded-xl transition-all group ${
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

      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <button
          onClick={logout}
          className="flex items-center space-x-3 px-4 py-3 w-full text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all font-bold text-sm"
        >
          <LogOut className="w-5 h-5" />
          <span>Déconnexion</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
