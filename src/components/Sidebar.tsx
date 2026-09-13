'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard, Map, ListOrdered, BarChart3,
  Settings, ChevronLeft, ChevronRight, LogOut, Shield
} from 'lucide-react';

interface SidebarProps {
  activeRoute: string;
  onNavigate: (route: string) => void;
  user?: { name?: string | null; role?: string | null } | null;
  onSignOut?: () => void;
}

const NAV_ITEMS = [
  { id: 'dispatcher', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'map', label: 'Live Map', icon: Map },
  { id: 'queue', label: 'Incidents', icon: ListOrdered },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeRoute,
  onNavigate,
  user,
  onSignOut,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`h-full flex flex-col border-r border-white/5 transition-all duration-200 shrink-0 ${
        collapsed ? 'w-[60px]' : 'w-[200px]'
      }`}
      style={{ background: 'rgba(9,9,11,0.95)', backdropFilter: 'blur(16px)' }}
    >
      {/* Logo */}
      <div className="h-12 flex items-center px-3 border-b border-white/5 shrink-0">
        {!collapsed && (
          <span className="font-extrabold text-sm tracking-wider uppercase text-white flex-1">
            Agap<span className="text-red-500">AI</span>
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-all"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = activeRoute === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-neutral-500 hover:text-white hover:bg-white/5'
              } ${collapsed ? 'justify-center px-0' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={18} className={isActive ? 'text-white' : 'text-neutral-500'} />
              {!collapsed && (
                <span className="text-[12px] font-medium">{item.label}</span>
              )}
              {isActive && !collapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </button>
          );
        })}
      </nav>

      {/* User section */}
      <div className="px-2 py-3 border-t border-white/5 shrink-0">
        {user && !collapsed && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-white/5">
            <Shield size={14} className="text-neutral-500" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-neutral-300 truncate">{user.name || 'User'}</p>
              <p className="text-[9px] text-neutral-600 uppercase">{user.role}</p>
            </div>
          </div>
        )}
        {onSignOut && (
          <button
            onClick={onSignOut}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-all ${
              collapsed ? 'justify-center px-0' : ''
            }`}
            title={collapsed ? 'Sign Out' : undefined}
          >
            <LogOut size={16} />
            {!collapsed && <span className="text-[11px]">Sign Out</span>}
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
