'use client';

import React, { useEffect } from 'react';
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

/** One nav row, used by the desktop rail, the mobile sheet, and the drawer. */
function NavButton({
  item,
  isActive,
  collapsed,
  onClick,
}: {
  item: (typeof NAV_ITEMS)[number];
  isActive: boolean;
  collapsed?: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
        collapsed ? 'justify-center px-0' : ''
      } ${
        isActive
          ? 'bg-white/[0.07] text-ink-1'
          : 'text-ink-3 hover:bg-white/[0.04] hover:text-ink-1'
      }`}
    >
      {/* Active rail — the one bit of accent in the chrome */}
      <span
        aria-hidden
        className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full transition-colors ${
          isActive ? 'bg-[var(--critical)]' : 'bg-transparent'
        }`}
      />
      <Icon size={17} className={isActive ? 'text-ink-1' : 'text-ink-3 group-hover:text-ink-2'} />
      {!collapsed && (
        <span className="text-[13px] font-medium tracking-tight">{item.label}</span>
      )}
      {isActive && !collapsed && (
        <span className="status-dot status-dot-ok ml-auto" aria-hidden />
      )}
    </button>
  );
}

function UserCard({ user }: { user: NonNullable<SidebarProps['user']> }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-white/[0.05] px-3 py-2">
      <Shield size={14} className="text-ink-3" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium leading-tight text-ink-2">
          {user.name || 'User'}
        </p>
        <p className="data-label data-label-tight mt-0.5 truncate">{user.role}</p>
      </div>
    </div>
  );
}

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
      className={`hidden h-full shrink-0 flex-col border-r border-[var(--line)] bg-surface-1 transition-all duration-200 md:flex ${
        collapsed ? 'w-[64px]' : 'w-[208px]'
      }`}
    >
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center border-b border-[var(--line)] px-3">
        {!collapsed && (
          <span className="flex-1 text-sm font-extrabold uppercase tracking-[0.14em]">
            Agap<span className="text-[var(--critical)]">AI</span>
          </span>
        )}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="btn btn-icon btn-ghost"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3" aria-label="Main">
        {NAV_ITEMS.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            isActive={activeRoute === item.id}
            collapsed={collapsed}
            onClick={() => onNavigate(item.id)}
          />
        ))}
      </nav>

      {/* User section */}
      <div className="shrink-0 border-t border-[var(--line)] px-2 py-3">
        {user && !collapsed && (
          <div className="mb-2">
            <UserCard user={user} />
          </div>
        )}
        {onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-ink-3 transition-colors hover:bg-[color-mix(in_srgb,var(--critical)_12%,transparent)] hover:text-[var(--critical)] ${
              collapsed ? 'justify-center px-0' : ''
            }`}
            title={collapsed ? 'Sign Out' : undefined}
            aria-label={collapsed ? 'Sign Out' : undefined}
          >
            <LogOut size={16} />
            {!collapsed && <span className="text-[13px] font-medium">Sign Out</span>}
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
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--line)] bg-surface-1/95 backdrop-blur md:hidden"
      aria-label="Main"
    >
      <div className="flex h-16 items-stretch">
        {mobileItems.map((item) => {
          const isActive = activeRoute === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors ${
                isActive ? 'text-ink-1' : 'text-ink-3'
              }`}
            >
              <Icon size={18} />
              <span className="text-[11px] font-medium leading-none tracking-tight">
                {item.label}
              </span>
              {isActive && (
                <span
                  aria-hidden
                  className="absolute top-0 h-0.5 w-6 rounded-full bg-[var(--critical)]"
                />
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
    <header className="chrome flex h-14 min-h-14 shrink-0 items-center justify-between px-3 md:hidden">
      <div className="flex items-center gap-2">
        {onMenuToggle && (
          <button
            type="button"
            onClick={onMenuToggle}
            className="btn btn-icon btn-ghost"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
        )}
        <h1 className="text-sm font-bold tracking-tight">{title}</h1>
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
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* Menu panel */}
      <div className="absolute bottom-0 left-0 top-0 flex w-72 flex-col border-r border-[var(--line)] bg-surface-1 animate-slide-in-right">
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--line)] px-4">
          <span className="text-sm font-extrabold uppercase tracking-[0.14em]">
            Agap<span className="text-[var(--critical)]">AI</span>
          </span>
          <button type="button" onClick={onClose} className="btn btn-icon btn-ghost" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={activeRoute === item.id}
              onClick={() => { onNavigate(item.id); onClose(); }}
            />
          ))}
        </nav>

        {/* User section */}
        <div className="shrink-0 border-t border-[var(--line)] px-3 py-3">
          {user && (
            <div className="mb-2">
              <UserCard user={user} />
            </div>
          )}
          {onSignOut && (
            <button
              type="button"
              onClick={() => { onSignOut(); onClose(); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-ink-3 transition-colors hover:bg-[color-mix(in_srgb,var(--critical)_12%,transparent)] hover:text-[var(--critical)]"
            >
              <LogOut size={16} />
              <span className="text-[13px] font-medium">Sign Out</span>
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
