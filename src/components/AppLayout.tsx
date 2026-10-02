'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import Navigation from '@/components/Navigation';
import { useSidebar } from '@/contexts/SidebarContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isCollapsed, toggle } = useSidebar();

  return (
    <ProtectedRoute>
      <div className="print:hidden">
        <Navigation isCollapsed={isCollapsed} onToggle={toggle} />
      </div>
      <main className={`pt-[60px] md:pt-0 pb-20 md:pb-0 min-h-screen bg-gray-50 transition-all duration-300 print:m-0 print:p-0 print:bg-white print:min-h-0 ${isCollapsed ? 'md:ml-20' : 'md:ml-60'} print:ml-0 md:print:ml-0`}>
        {children}
      </main>
    </ProtectedRoute>
  );
}
