import React from 'react';
import { LayoutDashboard, ShoppingBag, History, Sliders, ShieldCheck, Sparkles } from 'lucide-react';
import type { NavTab } from '../types';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  homeCurrency: string;
  availableBalance: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  homeCurrency,
  availableBalance
}) => {
  const navItems = [
    { id: 'overview' as NavTab, label: 'Overview', icon: LayoutDashboard },
    { id: 'check' as NavTab, label: 'Check a Purchase', icon: ShoppingBag },
    { id: 'history' as NavTab, label: 'Decision History', icon: History },
    { id: 'preferences' as NavTab, label: 'Preferences', icon: Sliders },
  ];

  return (
    <aside className="w-full md:w-64 bg-[#173F35] text-white flex flex-col justify-between p-5 md:min-h-screen">
      <div>
        {/* Brand */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#DDF3A0] text-[#18241F] flex items-center justify-center font-bold text-xl shadow-sm">
            <ShieldCheck className="w-6 h-6 text-[#173F35]" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Buy or Wait?</h1>
            <p className="text-xs text-[#DDF3A0] font-medium">A little clarity before you spend.</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-[#DDF3A0] text-[#18241F] shadow-sm font-semibold'
                    : 'text-emerald-100 hover:bg-[#1f5246] hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-[#173F35]' : 'text-emerald-200'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Balance Summary Card */}
      <div className="mt-8 pt-5 border-t border-emerald-800/60">
        <div className="bg-[#1f5246]/70 p-4 rounded-xl border border-emerald-700/40">
          <span className="text-xs text-emerald-200 font-medium uppercase tracking-wider block mb-1">Available Balance</span>
          <div className="text-xl font-bold text-white tracking-tight">
            {homeCurrency} {availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-[#DDF3A0]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Cash-Flow Protected</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
