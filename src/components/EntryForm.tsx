// src/components/EntryForm.tsx
'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Entry, Referrer } from '@/lib/types';
import { calculateEntry, formatCurrency, getTodayISO } from '@/lib/calculations';
import { addEntry, updateEntry, fetchReferrers, addReferrer, logActivity, getCachedReferrers } from '@/lib/firestore';
import { X, Plus, Calculator, Loader2 } from 'lucide-react';

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDate(editEntry.date);
      setPatientName(editEntry.patientName);
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-8 md:pt-16">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full mb-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {editEntry ? 'Edit Entry' : 'Add Entry'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
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

          {/* Date */}
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

          {/* Patient Name */}
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

          {/* Total / Received - side by side */}
          <div className="grid grid-cols-2 gap-3">
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
          </div>

          {/* Company Payable */}
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

          {/* Refer By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Refer By
            </label>
            <div className="flex gap-2">
              <select
                value={referBy}
                onChange={(e) => setReferBy(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="Self">Self</option>
                {referrers.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewReferrer(!showNewReferrer)}
                className="px-3 py-2 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors"
                title="Add new referrer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* New Referrer Input */}
          {showNewReferrer && (
            <div className="flex gap-2 ml-1">
              <input
                type="text"
                value={newReferrerName}
                onChange={(e) => setNewReferrerName(e.target.value)}
                placeholder="e.g. Dr. Sharma"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {addingReferrer ? 'Adding...' : 'Add'}
              </button>
            </div>
          )}

          {/* Referral Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Referral Amount
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
                disabled={referBy === 'Self'}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            {referBy === 'Self' && (
              <p className="text-gray-400 text-xs mt-1">
                Referral amount is ₹0 for self patients.
              </p>
            )}
            {errors.referAmount && (
              <p className="text-red-500 text-xs mt-1">{errors.referAmount}</p>
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

          {/* ─── Live Calculations ─── */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="w-4 h-4 text-gray-500" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Summary
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Patient Due</span>
              <span
                className={`font-semibold ${
                  calculations.due > 0
                    ? 'text-amber-600'
                    : 'text-emerald-600'
                }`}
              >
                {formatCurrency(calculations.due)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Net Profit</span>
              <span
                className={`font-semibold ${
                  calculations.netProfit >= 0
                    ? 'text-emerald-600'
                    : 'text-red-600'
                }`}
              >
                {formatCurrency(calculations.netProfit)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 pb-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !!successMsg}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
