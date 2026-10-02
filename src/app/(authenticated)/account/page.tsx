'use client';

import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { LogOut, ClipboardList, UserCircle, Activity } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import LogoutConfirmDialog from '@/components/LogoutConfirmDialog';

export default function AccountPage() {
  const { profile } = useAuth();

  const router = useRouter();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  if (!profile) return null;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-8">
          
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm mb-6">
            <div className="p-6 sm:p-8 flex items-center gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                <UserCircle className="w-10 h-10 sm:w-12 sm:h-12" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                    {profile.name || 'User'}
                  </h1>
                  <div className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700 uppercase tracking-wide flex-shrink-0">
                    {profile.role}
                  </div>
                </div>
                <p className="text-sm sm:text-base text-gray-500 truncate mt-1">{profile.email}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="p-2 sm:p-4 space-y-2">
              {profile.role === 'admin' && (
                <Link
                  href="/settings/users"
                  className="flex items-center gap-3 w-full px-4 py-3 sm:py-4 rounded-lg text-sm sm:text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-600">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-gray-900 font-medium">User Management</p>
                    <p className="text-xs sm:text-sm text-gray-500 font-normal mt-0.5">Manage staff access and accounts</p>
                  </div>
                </Link>
              )}
              {profile.role === 'admin' && (
                <Link
                  href="/settings/logs"
                  className="flex items-center gap-3 w-full px-4 py-3 sm:py-4 rounded-lg text-sm sm:text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-600">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-gray-900 font-medium">Activity Logs</p>
                    <p className="text-xs sm:text-sm text-gray-500 font-normal mt-0.5">Track system actions and history</p>
                  </div>
                </Link>
              )}
              
              <button
                onClick={() => setShowLogoutModal(true)}
                className="flex items-center gap-3 w-full px-4 py-3 sm:py-4 rounded-lg text-sm sm:text-base font-medium text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 text-red-600">
                  <LogOut className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-red-600">Sign Out</p>
                  <p className="text-xs sm:text-sm text-red-400 font-normal mt-0.5">Log out of your account</p>
                </div>
              </button>
            </div>
          </div>

          <LogoutConfirmDialog
            isOpen={showLogoutModal}
            onCancel={() => setShowLogoutModal(false)}
            onConfirm={handleLogout}
            isLoggingOut={isLoggingOut}
          />

        </div>
    </AppLayout>
  );
}
