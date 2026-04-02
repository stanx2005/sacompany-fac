import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Bell } from 'lucide-react';
import Sidebar from './Sidebar';
import api from '../services/api';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => {
      if (mq.matches) setMobileNavOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/notifications');
        const n =
          (data.upcomingCheques?.length || 0) +
          (data.overdueInvoices?.length || 0) +
          (data.userRemindersDue?.length || 0);
        setNotifCount(n);
      } catch {
        setNotifCount(0);
      }
    };
    load();
    const t = window.setInterval(load, 120000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="flex min-h-screen min-h-[100dvh] bg-[#f8fafc]">
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Fermer le menu"
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <Sidebar
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-slate-200/60 bg-white/90 px-4 backdrop-blur-md sm:h-16 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Ouvrir le menu"
              aria-expanded={mobileNavOpen}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 lg:hidden"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-5 w-5" strokeWidth={2.25} />
            </button>
            <div className="flex min-w-0 items-center gap-2 text-slate-400">
              <span className="hidden truncate text-[10px] font-bold uppercase tracking-widest sm:inline sm:text-xs">
                Espace de Travail
              </span>
              <span className="hidden text-slate-200 sm:inline">/</span>
              <span className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-600 sm:text-xs">
                SA-COMPANY
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              to="/reminders"
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
              title="Rappels: chèques, factures en retard, rappels personnels"
            >
              <Bell className="h-5 w-5" strokeWidth={2.25} />
              {notifCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
                  {notifCount > 99 ? '99+' : notifCount}
                </span>
              )}
            </Link>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 sm:h-9 sm:w-9">
              AD
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
