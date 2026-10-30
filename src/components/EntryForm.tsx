// src/components/EntryForm.tsx
'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Entry, Referrer, SelectedTest } from '@/lib/types';
import { calculateEntry, formatCurrency, getTodayISO } from '@/lib/calculations';
import { addEntry, updateEntry, fetchReferrers, addReferrer, deleteReferrer, logActivity, getCachedReferrers } from '@/lib/firestore';
import { X, Plus, Calculator, Loader2, Trash2 } from 'lucide-react';
import TestSearchSelector from '@/components/TestSearchSelector';

interface EntryFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editEntry?: Entry | null;
}

interface FormErrors {
  patientName?: string;
  date?: string;
  totalAmount?: string;
  receivedAmount?: string;
  companyAmount?: string;
  referAmount?: string;
  general?: string;
}

export default function EntryForm({
  isOpen,
  onClose,
  onSaved,
  editEntry,
}: EntryFormProps) {
  const { user, profile } = useAuth();

  // Form state
  const [date, setDate] = useState(getTodayISO());
  const [patientName, setPatientName] = useState('');
  const [selectedTests, setSelectedTests] = useState<SelectedTest[]>([]);
  const [totalAmount, setTotalAmount] = useState('');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [companyAmount, setCompanyAmount] = useState('');
  const [referBy, setReferBy] = useState('Self');
  const [referAmount, setReferAmount] = useState('');
  const [notes, setNotes] = useState('');

  // Referrers
  const initReferrers = getCachedReferrers();
  const [referrers, setReferrers] = useState<Referrer[]>(initReferrers || []);
  const [newReferrerName, setNewReferrerName] = useState('');
  const [showNewReferrer, setShowNewReferrer] = useState(false);
  const [addingReferrer, setAddingReferrer] = useState(false);

  // UI state
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [isOnline, setIsOnline] = useState(true);

  // Track online status
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load referrers when form opens
  useEffect(() => {
    if (isOpen && user) {
      fetchReferrers().then(setReferrers).catch(console.error);
    }
  }, [isOpen, user]);

  // Populate form for editing
  useEffect(() => {
    if (editEntry) {
      setDate(editEntry.date);
      setPatientName(editEntry.patientName);
      setSelectedTests(editEntry.tests || []);
      setTotalAmount(String(editEntry.totalAmount));
      setReceivedAmount(String(editEntry.receivedAmount));
      setCompanyAmount(String(editEntry.companyAmount));
      setReferBy(editEntry.referBy);
      setReferAmount(String(editEntry.referAmount));
      setNotes(editEntry.notes || '');
    } else {
      resetForm();
    }
  }, [editEntry, isOpen]);

  // Auto-zero referral amount when "Self" selected
  useEffect(() => {
    if (referBy === 'Self') {
      setReferAmount('0');
    }
  }, [referBy]);

  // Live calculations
  const calculations = useMemo(() => {
    return calculateEntry(
      Number(totalAmount) || 0,
      Number(receivedAmount) || 0,
      Number(companyAmount) || 0,
      Number(referAmount) || 0
    );
  }, [totalAmount, receivedAmount, companyAmount, referAmount]);

  function resetForm() {
    setDate(getTodayISO());
    setPatientName('');
    setSelectedTests([]);
    setTotalAmount('');
    setReceivedAmount('');
    setCompanyAmount('');
    setReferBy('Self');
    setReferAmount('0');
    setNotes('');
    setErrors({});
    setSuccessMsg('');
    setShowNewReferrer(false);
    setNewReferrerName('');
  }

  function validate(): boolean {
    const newErrors: FormErrors = {};
    const total = Number(totalAmount) || 0;
    const received = Number(receivedAmount) || 0;
    const company = Number(companyAmount) || 0;
    const refer = Number(referAmount) || 0;

    if (!patientName.trim()) {
      newErrors.patientName = 'Patient name is required.';
    }
    if (!date) {
      newErrors.date = 'Date is required.';
    }
    if (!totalAmount || total <= 0) {
      newErrors.totalAmount = 'Total amount is required and must be greater than 0.';
    }
    if (received < 0) {
      newErrors.receivedAmount = 'Received amount cannot be negative.';
    }
    if (received > total) {
      newErrors.receivedAmount = 'Received amount cannot be greater than total amount.';
    }
    if (company < 0) {
      newErrors.companyAmount = 'Company amount cannot be negative.';
    }
    if (refer < 0) {
      newErrors.referAmount = 'Referral amount cannot be negative.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) return;
    if (!user) return;

    if (!isOnline) {
      setErrors({
        general: 'You are offline. Cannot save while offline.',
      });
      return;
    }

    setSaving(true);
    try {
      const entryData = {
        date,
        patientName: patientName.trim(),
        tests: selectedTests,
        totalAmount: Number(totalAmount) || 0,
        receivedAmount: Number(receivedAmount) || 0,
        companyAmount: Number(companyAmount) || 0,
        referBy,
        referAmount: referBy === 'Self' ? 0 : Number(referAmount) || 0,
        notes: notes.trim(),
        createdBy: user.uid,
      };

      if (editEntry) {
        await updateEntry(editEntry.id, entryData, user.uid);
        if (profile) await logActivity('UPDATE_ENTRY', `Updated entry for ${patientName.trim()}`, profile);
        setSuccessMsg('Entry updated successfully.');
      } else {
        await addEntry(entryData);
        if (profile) await logActivity('CREATE_ENTRY', `Added entry for ${patientName.trim()}`, profile);
        setSuccessMsg('Entry added successfully.');
      }

      onSaved();
      
      // Delay closing to show success message
      setTimeout(() => {
        onClose();
        resetForm();
      }, 1500);
    } catch (error) {
      console.error('Error saving entry:', error);
      setErrors({
        general: 'Failed to save entry. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddReferrer() {
    if (!newReferrerName.trim() || !user) return;
    setAddingReferrer(true);
    try {
      await addReferrer(newReferrerName.trim(), user.uid);
      const updated = await fetchReferrers();
      setReferrers(updated);
      setReferBy(newReferrerName.trim());
      setNewReferrerName('');
      setShowNewReferrer(false);
    } catch (error) {
      console.error('Error adding referrer:', error);
    } finally {
      setAddingReferrer(false);
    }
  }

  const [deletingReferrer, setDeletingReferrer] = useState(false);

  async function handleDeleteReferrer() {
    if (profile?.role !== 'admin' || referBy === 'Self') return;
    const target = referrers.find(
      (r) => r.name.toLowerCase() === referBy.toLowerCase()
    );
    if (!target) return;
    if (
      !window.confirm(
        `Are you sure you want to delete referrer "${referBy}"? Only admins can perform this.`
      )
    )
      return;

    setDeletingReferrer(true);
    try {
      await deleteReferrer(target.id);
      if (profile) {
        await logActivity(
          'DELETE_REFERRER',
          `Deleted referrer "${referBy}"`,
          profile
        );
      }
      const updated = await fetchReferrers(true);
      setReferrers(updated);
      setReferBy('Self');
    } catch (err) {
      console.error('Failed to delete referrer:', err);
      alert('Failed to delete referrer. Only administrators can delete referrers.');
    } finally {
      setDeletingReferrer(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl lg:max-w-4xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Fixed Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0 bg-white">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {editEntry ? 'Edit Entry' : 'Add Entry'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {editEntry ? 'Update patient transaction details' : 'Enter patient billing and referral details'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
            {successMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-2.5 rounded-lg flex justify-center font-medium">
                {successMsg}
              </div>
            )}
            {errors.general && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">
                {errors.general}
              </div>
            )}

            {/* Date & Patient Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {errors.date && (
                  <p className="text-red-500 text-xs mt-1">{errors.date}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patient Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="e.g. Abha Devi"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {errors.patientName && (
                  <p className="text-red-500 text-xs mt-1">{errors.patientName}</p>
                )}
              </div>
            </div>

            {/* ─── Test Selection with Search Box ─── */}
            <TestSearchSelector
              selectedTests={selectedTests}
              onChange={setSelectedTests}
              onTotalAmountChange={(newTotal) => setTotalAmount(newTotal > 0 ? String(newTotal) : '')}
            />

            {/* ─── Financial Billing Inputs ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                {errors.totalAmount && (
                  <p className="text-red-500 text-xs mt-1">{errors.totalAmount}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Received
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                {errors.receivedAmount && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.receivedAmount}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Payable
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    value={companyAmount}
                    onChange={(e) => setCompanyAmount(e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                {errors.companyAmount && (
                  <p className="text-red-500 text-xs mt-1">{errors.companyAmount}</p>
                )}
              </div>
            </div>

            {/* ─── Referral Details ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Refer By
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowNewReferrer(!showNewReferrer)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{showNewReferrer ? 'Close' : 'Add New Referrer'}</span>
                  </button>
                </div>
                <div className="flex gap-2">
                  <select
                    value={referBy}
                    onChange={(e) => setReferBy(e.target.value)}
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="Self">Self (No Referral)</option>
                    {referrers.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  {profile?.role === 'admin' && referBy !== 'Self' && (
                    <button
                      type="button"
                      onClick={handleDeleteReferrer}
                      disabled={deletingReferrer}
                      className="px-2.5 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 border border-rose-200 rounded-lg transition-colors flex-shrink-0 disabled:opacity-50"
                      title="Admin only: Delete selected referrer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowNewReferrer(!showNewReferrer)}
                    className="px-3 py-2 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors flex-shrink-0"
                    title="Add new referrer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* New Referrer Input inline under Refer By */}
                {showNewReferrer && (
                  <div className="flex gap-2 p-2 mt-2 bg-blue-50/60 rounded-lg border border-blue-100 animate-in fade-in duration-100">
                    <input
                      type="text"
                      value={newReferrerName}
                      onChange={(e) => setNewReferrerName(e.target.value)}
                      placeholder="Doctor name (e.g. Dr. Sharma)"
                      className="flex-1 min-w-0 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddReferrer();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddReferrer}
                      disabled={addingReferrer || !newReferrerName.trim()}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0"
                    >
                      {addingReferrer ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                )}
              </div>

              {/* Referral Amount (shown when referrer selected) */}
              {referBy !== 'Self' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Referral Amount ({referBy})
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      value={referAmount}
                      onChange={(e) => setReferAmount(e.target.value)}
                      placeholder="0"
                      min="0"
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  {errors.referAmount && (
                    <p className="text-red-500 text-xs mt-1">{errors.referAmount}</p>
                  )}
                </div>
              ) : (
                <div className="hidden sm:flex flex-col justify-end pb-2.5 text-xs text-gray-400">
                  <span>No referral fee applies for Self.</span>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* ─── Live Calculations Summary Card ─── */}
            <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <Calculator className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Summary
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-2.5 rounded-lg border border-gray-100 shadow-sm">
                  <span className="text-xs text-gray-500 block mb-0.5">Patient Due</span>
                  <span
                    className={`text-base font-bold ${
                      calculations.due > 0
                        ? 'text-amber-600'
                        : 'text-emerald-600'
                    }`}
                  >
                    {formatCurrency(calculations.due)}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-gray-100 shadow-sm">
                  <span className="text-xs text-gray-500 block mb-0.5">Net Profit</span>
                  <span
                    className={`text-base font-bold ${
                      calculations.netProfit >= 0
                        ? 'text-emerald-600'
                        : 'text-red-600'
                    }`}
                  >
                    {formatCurrency(calculations.netProfit)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Actions Footer */}
          <div className="flex items-center gap-3 px-6 py-3.5 border-t border-gray-100 bg-gray-50/90 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !!successMsg}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
            >
              {saving && !successMsg && <Loader2 className="w-4 h-4 animate-spin" />}
              {successMsg 
                ? 'Saved'
                : saving
                ? 'Saving...'
                : editEntry
                ? 'Update Entry'
                : 'Add Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
