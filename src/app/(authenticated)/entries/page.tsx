// src/app/entries/page.tsx
'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import OnlineStatus from '@/components/OnlineStatus';
import EntryForm from '@/components/EntryForm';
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog';
import { Entry } from '@/lib/types';
import Pagination from '@/components/Pagination';
import { fetchEntries, getCachedEntries, deleteEntry, fetchUserMap, getCachedUserMap, logActivity } from '@/lib/firestore';
import {
  calculateEntry,
  formatCurrency,
  formatDisplayDate,
} from '@/lib/calculations';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  FileX,
} from 'lucide-react';

type FilterType = 'all' | 'due' | 'paid' | 'self' | 'referred';

export default function EntriesPage() {
  const { user, profile } = useAuth();

  const initCached = getCachedEntries();
  const initUserMap = getCachedUserMap();
  
  const [entries, setEntries] = useState<Entry[]>(initCached || []);
  const [userMap, setUserMap] = useState<Record<string, string>>(initUserMap || {});
  const [loading, setLoading] = useState(!initCached);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<Entry | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [toastMsg, setToastMsg] = useState('');

  async function loadEntries() {
    if (!user) return;
    try {
      const data = await fetchEntries();
      setEntries(data);
    } catch (error) {
      console.error('Error fetching entries:', error);
    } finally {
      setLoading(false);
    }
  }

  // Very simple cache for user names
  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEntries();
    
    // Load user map for audit display
    fetchUserMap().then(setUserMap).catch(console.error);
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Filter and search
  const filteredEntries = useMemo(() => {
    let result = entries;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) =>
        e.patientName.toLowerCase().includes(q)
      );
    }

    // Type filter
    switch (activeFilter) {
      case 'due':
        result = result.filter(
          (e) => e.totalAmount - e.receivedAmount > 0
        );
        break;
      case 'paid':
        result = result.filter(
          (e) => e.totalAmount - e.receivedAmount <= 0
        );
        break;
      case 'self':
        result = result.filter((e) => e.referBy === 'Self');
        break;
      case 'referred':
        result = result.filter((e) => e.referBy !== 'Self');
        break;
    }

    return result;
  }, [entries, searchQuery, activeFilter]);

  const paginatedEntries = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredEntries.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredEntries, currentPage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1); // Reset page on filter change
  }, [searchQuery, activeFilter]);

  function handleEdit(entry: Entry) {
    setEditEntry(entry);
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditEntry(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteEntry(deleteTarget.id);
      if (profile) await logActivity('DELETE_ENTRY', `Deleted entry for ${deleteTarget.patientName}`, profile);
      setEntries((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      setDeleteTarget(null);
      setToastMsg('Entry deleted successfully.');
      setTimeout(() => setToastMsg(''), 3000);
    } catch (error) {
      console.error('Error deleting entry:', error);
    } finally {
      setIsDeleting(false);
    }
  }

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'due', label: 'Due' },
    { key: 'paid', label: 'Paid' },
    { key: 'self', label: 'Self' },
    { key: 'referred', label: 'Referred' },
  ];

  return (
    <AppLayout>
      <OnlineStatus />
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">
        {/* ─── Header & Search ─── */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patient..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => {
              setEditEntry(null);
              setShowForm(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Entry</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>

        {/* ─── Filters ─── */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeFilter === f.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ─── Loading ─── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs uppercase tracking-widest font-medium">Loading Entries...</span>
          </div>
        ) : filteredEntries.length === 0 ? (
          /* ─── Empty State ─── */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileX className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">
              {searchQuery || activeFilter !== 'all'
                ? 'No entries found.'
                : 'No entries found. Add your first entry.'}
            </p>
          </div>
        ) : (
          <>
            {/* ─── Desktop Table ─── */}
            <div className="hidden lg:block bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                        Date
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                        Patient
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                        Total
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                        Received
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                        Due
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                        Company
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                        Refer By
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                        Referral
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                        Net Profit
                      </th>
                      <th className="text-center px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedEntries.map((entry) => {
                      const calc = calculateEntry(
                        entry.totalAmount,
                        entry.receivedAmount,
                        entry.companyAmount,
                        entry.referAmount
                      );
                      return (
                        <tr
                          key={entry.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {formatDisplayDate(entry.date)}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            <div>{entry.patientName}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5 font-normal">
                              Added by {userMap[entry.createdBy] || entry.createdBy.slice(0, 5)}
                              {entry.updatedBy && ` • Edited by ${userMap[entry.updatedBy] || entry.updatedBy.slice(0, 5)}`}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-800 font-medium">
                            {formatCurrency(entry.totalAmount)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {formatCurrency(entry.receivedAmount)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-semibold ${
                              calc.due > 0
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            {formatCurrency(calc.due)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {formatCurrency(entry.companyAmount)}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {entry.referBy}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {formatCurrency(entry.referAmount)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-semibold ${
                              calc.netProfit >= 0
                                ? 'text-emerald-600'
                                : 'text-red-600'
                            }`}
                          >
                            {formatCurrency(calc.netProfit)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleEdit(entry)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              {profile?.role === 'admin' && (
                                <button
                                  onClick={() => setDeleteTarget(entry)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ─── Mobile Cards ─── */}
            <div className="lg:hidden space-y-3">
              {paginatedEntries.map((entry) => {
                const calc = calculateEntry(
                  entry.totalAmount,
                  entry.receivedAmount,
                  entry.companyAmount,
                  entry.referAmount
                );
                return (
                  <div
                    key={entry.id}
                    className="bg-white rounded-xl border border-gray-200 p-4"
                  >
                    {/* Card header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm">
                          {entry.patientName}
                        </h3>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {formatDisplayDate(entry.date)} • By {userMap[entry.createdBy] || entry.createdBy.slice(0, 5)}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEdit(entry)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {profile?.role === 'admin' && (
                          <button
                            onClick={() => setDeleteTarget(entry)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Card rows */}
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Total</span>
                        <span className="font-medium text-gray-800">
                          {formatCurrency(entry.totalAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Received</span>
                        <span className="text-gray-600">
                          {formatCurrency(entry.receivedAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Due</span>
                        <span
                          className={`font-semibold ${
                            calc.due > 0
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {formatCurrency(calc.due)}
                        </span>
                      </div>

                      <div className="border-t border-gray-100 my-1.5" />

                      <div className="flex justify-between">
                        <span className="text-gray-500">Company</span>
                        <span className="text-gray-600">
                          {formatCurrency(entry.companyAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Refer By</span>
                        <span className="text-gray-600">{entry.referBy}</span>
                      </div>
                      {entry.referBy !== 'Self' && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Referral</span>
                          <span className="text-gray-600">
                            {formatCurrency(entry.referAmount)}
                          </span>
                        </div>
                      )}

                      <div className="border-t border-gray-100 my-1.5" />

                      <div className="flex justify-between">
                        <span className="text-gray-500 font-medium">
                          Net Profit
                        </span>
                        <span
                          className={`font-bold ${
                            calc.netProfit >= 0
                              ? 'text-emerald-600'
                              : 'text-red-600'
                          }`}
                        >
                          {formatCurrency(calc.netProfit)}
                        </span>
                      </div>
                    </div>

                    {/* Notes */}
                    {entry.notes && (
                      <p className="text-xs text-gray-400 mt-2 italic">
                        {entry.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ─── Entry count & Pagination ─── */}
        {!loading && filteredEntries.length > 0 && (
          <div className="mt-4 bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
            <Pagination
              currentPage={currentPage}
              totalItems={filteredEntries.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* ─── Entry Form Modal ─── */}
      <EntryForm
        isOpen={showForm}
        onClose={handleCloseForm}
        onSaved={loadEntries}
        editEntry={editEntry}
      />

      {/* ─── Delete Confirmation ─── */}
      <DeleteConfirmDialog
        isOpen={!!deleteTarget}
        patientName={deleteTarget?.patientName || ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />

      {/* ─── Toast Message ─── */}
      {toastMsg && (
        <div className="fixed bottom-24 md:bottom-10 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up">
          <div className="bg-gray-900 text-white px-6 py-3 rounded-full shadow-xl text-sm font-medium">
            {toastMsg}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
