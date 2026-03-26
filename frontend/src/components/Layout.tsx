import React from 'react';
import Sidebar from './Sidebar';

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-10 flex items-center px-8 justify-between">
          <div className="flex items-center space-x-2 text-slate-400">
            <span className="text-xs font-bold uppercase tracking-widest">Espace de Travail</span>
            <span className="text-slate-200">/</span>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-600">SA COMPANY</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">
              AD
            </div>
          </div>
        </header>
        <main className="p-8 max-w-[1600px] mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
