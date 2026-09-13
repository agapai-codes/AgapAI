'use client';

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Map, ListOrdered, BarChart3,
  Settings, ChevronLeft, ChevronRight, LogOut, Shield, Siren,
  Menu, X
} from 'lucide-react';

interface SidebarProps {
  activeRoute: string;
  onNavigate: (route: string) => void;
  user?: { name?: string | null; role?: string | null } | null;
  onSignOut?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const NAV_ITEMS = [
  { id: 'dispatcher', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'responder', label: 'Responder', icon: Siren },
  { id: 'map', label: 'Live Map', icon: Map },
  { id: 'queue', label: 'Incidents', icon: ListOrdered },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

// ── Desktop Sidebar ───────────────────────────────────────────────────────

export const DesktopSidebar: React.FC<SidebarProps> = ({
  activeRoute,
  onNavigate,
  user,
  onSignOut,
  collapsed,
  onToggleCollapse,
}) => {
  return (
    <aside
      className={`hidden md:flex h-full flex-col border-r border-white/5 transition-all duration-200 shrink-0 ${
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
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-all"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        )}
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

// ── Mobile Bottom Nav ─────────────────────────────────────────────────────

export const MobileBottomNav: React.FC<{
  activeRoute: string;
  onNavigate: (route: string) => void;
}> = ({ activeRoute, onNavigate }) => {
  const mobileItems = NAV_ITEMS.slice(0, 5); // Show 5 items max on mobile

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/5"
      style={{ background: 'rgba(9,9,11,0.95)', backdropFilter: 'blur(16px)' }}>
      <div className="flex items-center justify-around h-14">
        {mobileItems.map((item) => {
          const isActive = activeRoute === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 w-full h-full transition-all ${
                isActive ? 'text-white' : 'text-neutral-500'
              }`}
            >
              <item.icon size={18} />
              <span className="text-[9px] font-medium">{item.label}</span>
              {isActive && (
                <div className="absolute bottom-1 w-4 h-0.5 rounded-full bg-white" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

// ── Mobile Header ─────────────────────────────────────────────────────────

export const MobileHeader: React.FC<{
  title: string;
  onMenuToggle?: () => void;
  actions?: React.ReactNode;
}> = ({ title, onMenuToggle, actions }) => {
  return (
    <header className="md:hidden h-12 min-h-[48px] border-b border-white/5 flex items-center justify-between px-4 shrink-0"
      style={{ background: 'rgba(9,9,11,0.95)', backdropFilter: 'blur(16px)' }}>
      <div className="flex items-center gap-2">
        {onMenuToggle && (
          <button onClick={onMenuToggle} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <Menu size={18} className="text-neutral-400" />
          </button>
        )}
        <span className="text-sm font-bold text-white">{title}</span>
      </div>
      {actions}
    </header>
  );
};

// ── Mobile Slide-out Menu ─────────────────────────────────────────────────

export const MobileSlideMenu: React.FC<{
  open: boolean;
  onClose: () => void;
  activeRoute: string;
  onNavigate: (route: string) => void;
  user?: { name?: string | null; role?: string | null } | null;
  onSignOut?: () => void;
}> = ({ open, onClose, activeRoute, onNavigate, user, onSignOut }) => {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="md:hidden fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Menu panel */}
      <div className="absolute left-0 top-0 bottom-0 w-72 flex flex-col"
        style={{ background: 'rgba(9,9,11,0.98)', backdropFilter: 'blur(20px)' }}>
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-white/5">
          <span className="font-extrabold text-sm tracking-wider uppercase text-white">
            Agap<span className="text-red-500">AI</span>
          </span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <X size={18} className="text-neutral-400" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = activeRoute === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { onNavigate(item.id); onClose(); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-neutral-500 hover:text-white hover:bg-white/5'
                }`}
              >
                <item.icon size={18} className={isActive ? 'text-white' : 'text-neutral-500'} />
                <span className="text-[12px] font-medium">{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </button>
            );
          })}
        </nav>

        {/* User section */}
        <div className="px-3 py-3 border-t border-white/5">
          {user && (
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
              onClick={() => { onSignOut(); onClose(); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut size={16} />
              <span className="text-[11px]">Sign Out</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Legacy export (defaults to desktop) ───────────────────────────────────

export const Sidebar: React.FC<SidebarProps> = (props) => (
  <DesktopSidebar {...props} />
);

export default Sidebar;
