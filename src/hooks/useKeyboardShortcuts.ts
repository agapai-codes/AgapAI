'use client';

import { useEffect, useCallback } from 'react';

interface ShortcutHandlers {
  onEscape?: () => void;
  onSearch?: () => void;
  onRefresh?: () => void;
  onFilterHigh?: () => void;
  onFilterMedium?: () => void;
  onFilterLow?: () => void;
  onFilterAll?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
      // Allow Escape even in inputs
      if (e.key === 'Escape') {
        handlers.onEscape?.();
        return;
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        handlers.onEscape?.();
        break;
      case '/':
      case 'k':
        if (e.ctrlKey || e.metaKey || e.key === '/') {
          e.preventDefault();
          handlers.onSearch?.();
        }
        break;
      case 'r':
        if (!e.ctrlKey && !e.metaKey) {
          handlers.onRefresh?.();
        }
        break;
      case '1':
        handlers.onFilterAll?.();
        break;
      case '2':
        handlers.onFilterHigh?.();
        break;
      case '3':
        handlers.onFilterMedium?.();
        break;
      case '4':
        handlers.onFilterLow?.();
        break;
    }
  }, [handlers]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
