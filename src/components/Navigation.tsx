// src/components/Navigation.tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import {
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  LogOut,
  UserCircle,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/entries', label: 'Entries', icon: ClipboardList },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/account', label: 'Account', icon: UserCircle },
];

interface NavigationProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export default function Navigation({ isCollapsed = false, onToggle }: NavigationProps) {
  const pathname = usePathname();
  const { user, profile } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const router = useRouter();

  if (!profile) return null;

  return (
    <>
      {/* ─── Desktop Sidebar ─── */}
      <aside className={`hidden md:flex md:flex-col md:fixed md:inset-y-0 bg-white border-r border-gray-200 z-30 transition-all duration-300 ${isCollapsed ? 'md:w-20' : 'md:w-60'}`}>
        {/* Logo */}
        <div className={`flex items-center px-5 py-5 border-b border-gray-100 ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}>
          <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain flex-shrink-0" />
          {!isCollapsed && (
            <span className="font-semibold text-gray-800 text-sm tracking-tight truncate">
              Diagnostic Manager
            </span>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center rounded-lg text-sm font-medium transition-colors ${
                  isCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        {/* Desktop Sidebar Bottom padding */}
        <div className="flex-1"></div>
        {/* Toggle Button */}
        {onToggle && (
          <div className="p-4 border-t border-gray-100 flex justify-center">
            <button
              onClick={onToggle}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
          </div>
        )}
      </aside>

      {/* ─── Mobile Top Bar ─── */}
      <header className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-30 px-4 py-3 flex items-center justify-start">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Logo" className="w-7 h-7 object-contain" />
          <span className="font-semibold text-gray-800 text-sm">
            Diagnostic Manager
          </span>
        </div>
      </header>

      {/* ─── Mobile Bottom Navigation ─── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 flex items-center justify-around py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'text-blue-700'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
