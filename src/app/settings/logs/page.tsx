'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import Pagination from '@/components/Pagination';
import { ActivityLog } from '@/lib/types';
import { getRecentLogs } from '@/lib/firestore';
import { Loader2, Activity, User, PlusCircle, Pencil, Trash2, Shield, Power } from 'lucide-react';
import { useRouter } from 'next/navigation';

function getActionIcon(action: string) {
  switch (action) {
    case 'CREATE_ENTRY':
      return <PlusCircle className="w-4 h-4 text-emerald-600" />;
    case 'UPDATE_ENTRY':
      return <Pencil className="w-4 h-4 text-blue-600" />;
    case 'DELETE_ENTRY':
      return <Trash2 className="w-4 h-4 text-red-600" />;
    case 'CREATE_USER':
      return <User className="w-4 h-4 text-purple-600" />;
    case 'TOGGLE_USER_STATUS':
      return <Power className="w-4 h-4 text-amber-600" />;
    default:
      return <Activity className="w-4 h-4 text-gray-600" />;
  }
}

function getActionColor(action: string) {
  switch (action) {
    case 'CREATE_ENTRY': return 'bg-emerald-100';
    case 'UPDATE_ENTRY': return 'bg-blue-100';
    case 'DELETE_ENTRY': return 'bg-red-100';
    case 'CREATE_USER': return 'bg-purple-100';
    case 'TOGGLE_USER_STATUS': return 'bg-amber-100';
    default: return 'bg-gray-100';
  }
}

export default function LogsPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    if (!authLoading && profile) {
      if (profile.role !== 'admin') {
        router.replace('/dashboard');
        return;
      }
      loadLogs();
    }
  }, [profile, authLoading, router]);

  async function loadLogs() {
    setLoading(true);
    try {
      const data = await getRecentLogs(200);
      setLogs(data);
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLogs = logs.slice(startIndex, startIndex + itemsPerPage);

  return (
    <AppLayout>
        <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
          
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">Activity Logs</h1>
              <p className="text-sm text-gray-500 mt-0.5">Track recent actions by all users</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {logs.length === 0 ? (
              <div className="p-8 text-center">
                <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No activity logged yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {paginatedLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors flex items-start gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${getActionColor(log.action)}`}>
                      {getActionIcon(log.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        <span className="font-semibold">{log.userName}</span>{' '}
                        <span className="text-gray-600">{log.details}</span>
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                        <span className="truncate">{log.userEmail}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {!loading && logs.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={logs.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            )}
          </div>

        </div>
    </AppLayout>
  );
}
