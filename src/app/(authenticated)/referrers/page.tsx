'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import OnlineStatus from '@/components/OnlineStatus';
import { Entry, Referrer, ReferrerPayment } from '@/lib/types';
import {
  fetchEntries,
  fetchReferrers,
  fetchReferrerPayments,
  addReferrerPayment,
  deleteReferrerPayment,
  deleteReferrer,
  logActivity,
} from '@/lib/firestore';
import {
  formatCurrency,
  formatDisplayDate,
  getTodayISO,
} from '@/lib/calculations';
import {
  UserCheck,
  Search,
  Plus,
  Printer,
  Trash2,
  Loader2,
  CheckCircle2,
  TrendingUp,
  Receipt,
  Users,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';

export default function ReferrersPage() {
  const { user, profile } = useAuth();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [referrers, setReferrers] = useState<Referrer[]>([]);
  const [payments, setPayments] = useState<ReferrerPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedReferrerName, setSelectedReferrerName] = useState<string>('');
  const [searchDoctor, setSearchDoctor] = useState('');

  // Payment form state
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(getTodayISO());
  const [payMode, setPayMode] = useState('Cash');
  const [payNotes, setPayNotes] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    loadAllData();
  }, [user]);

  async function loadAllData() {
    setLoading(true);
    try {
      const [allEntries, allRefs, allPays] = await Promise.all([
        fetchEntries(),
        fetchReferrers(),
        fetchReferrerPayments(),
      ]);
      setEntries(allEntries);
      setReferrers(allRefs);
      setPayments(allPays);

      // Default select first referrer if not selected
      const firstDoctor = allRefs.find((r) => r.name !== 'Self')?.name || '';
      if (!selectedReferrerName && firstDoctor) {
        setSelectedReferrerName(firstDoctor);
      }
    } catch (err) {
      console.error('Error loading referrers data:', err);
    } finally {
      setLoading(false);
    }
  }

  // Calculate stats for all referrers
  const referrerSummaries = useMemo(() => {
    const namesSet = new Set<string>();
    referrers.forEach((r) => {
      if (r.name !== 'Self') namesSet.add(r.name);
    });
    entries.forEach((e) => {
      if (e.referBy && e.referBy !== 'Self') {
        namesSet.add(e.referBy);
      }
    });

    const list = Array.from(namesSet).map((name) => {
      const doctorEntries = entries.filter((e) => e.referBy === name);
      const totalBilled = doctorEntries.reduce(
        (sum, e) => sum + (Number(e.totalAmount) || 0),
        0
      );

      const doctorPayments = payments.filter((p) => p.referrerName === name);
      const totalPaid = doctorPayments.reduce(
        (sum, p) => sum + (Number(p.amount) || 0),
        0
      );

      const balanceDue = totalBilled - totalPaid;
      const refDoc = referrers.find(
        (r) => r.name.toLowerCase() === name.toLowerCase()
      );

      return {
        id: refDoc?.id,
        name,
        totalBilled,
        totalPaid,
        balanceDue,
        patientCount: doctorEntries.length,
        entries: doctorEntries,
        payments: doctorPayments,
      };
    });

    list.sort((a, b) => b.balanceDue - a.balanceDue || a.name.localeCompare(b.name));
    return list;
  }, [referrers, entries, payments]);

  // Overall Global Stats across all referrers
  const globalStats = useMemo(() => {
    let totalBilled = 0;
    let totalSettled = 0;
    let totalDue = 0;

    referrerSummaries.forEach((r) => {
      totalBilled += r.totalBilled;
      totalSettled += r.totalPaid;
      if (r.balanceDue > 0) totalDue += r.balanceDue;
    });

    const activeWithCases = referrerSummaries.filter((r) => r.patientCount > 0).length;

    return {
      totalBilled,
      totalSettled,
      totalDue,
      activeDoctors: activeWithCases,
    };
  }, [referrerSummaries]);

  // Filtered doctor list for search
  const filteredSummaries = useMemo(() => {
    if (!searchDoctor.trim()) return referrerSummaries;
    const q = searchDoctor.toLowerCase();
    return referrerSummaries.filter((r) => r.name.toLowerCase().includes(q));
  }, [referrerSummaries, searchDoctor]);

  // Currently active selected doctor
  const activeSummary = useMemo(() => {
    if (!selectedReferrerName && referrerSummaries.length > 0) {
      return referrerSummaries[0];
    }
    return (
      referrerSummaries.find((r) => r.name === selectedReferrerName) ||
      referrerSummaries[0]
    );
  }, [referrerSummaries, selectedReferrerName]);

  async function handleAddPayment(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      setFormError('Please enter a valid amount greater than 0.');
      return;
    }
    if (!activeSummary || !user) return;

    setSavingPayment(true);
    setFormError('');

    try {
      const paymentData = {
        referrerName: activeSummary.name,
        amount,
        date: payDate,
        paymentMode: payMode,
        notes: payNotes.trim(),
        createdBy: user.uid,
      };

      const id = await addReferrerPayment(paymentData);

      if (profile) {
        await logActivity(
          'RECORD_REFERRER_PAYMENT',
          `Recorded payment of ₹${amount} to ${activeSummary.name}`,
          profile
        );
      }

      setPayments((prev) => [
        { id, ...paymentData, createdAt: new Date().toISOString() },
        ...prev,
      ]);

      setPayAmount('');
      setPayNotes('');
      setShowPaymentForm(false);
      setSuccessMsg(`Payment of ₹${amount} recorded for ${activeSummary.name}!`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Error saving payment:', err);
      setFormError('Failed to record payment. Please try again.');
    } finally {
      setSavingPayment(false);
    }
  }

  async function handleDeletePayment(payment: ReferrerPayment) {
    if (
      !window.confirm(
        `Are you sure you want to delete the payment of ₹${payment.amount} dated ${formatDisplayDate(
          payment.date
        )}?`
      )
    ) {
      return;
    }

    try {
      await deleteReferrerPayment(payment.id);
      if (profile) {
        await logActivity(
          'DELETE_REFERRER_PAYMENT',
          `Deleted payment of ₹${payment.amount} for ${payment.referrerName}`,
          profile
        );
      }
      setPayments((prev) => prev.filter((p) => p.id !== payment.id));
    } catch (err) {
      console.error('Error deleting payment:', err);
      alert('Failed to delete payment.');
    }
  }

  const [deletingReferrer, setDeletingReferrer] = useState(false);

  async function handleDeleteDoctor(doctor: { name: string; id?: string; patientCount: number }) {
    if (profile?.role !== 'admin') {
      alert('Only administrators have permission to delete referrers.');
      return;
    }

    const confirmMsg =
      doctor.patientCount > 0
        ? `Are you sure you want to delete referrer "${doctor.name}"?\n\nWarning: There are ${doctor.patientCount} patient record(s) linked to this doctor. Deleting will remove this doctor from the active referrers directory.`
        : `Are you sure you want to delete referrer "${doctor.name}"?`;

    if (!window.confirm(confirmMsg)) return;

    setDeletingReferrer(true);
    try {
      if (doctor.id) {
        await deleteReferrer(doctor.id);
      }
      if (profile) {
        await logActivity(
          'DELETE_REFERRER',
          `Deleted referrer "${doctor.name}"`,
          profile
        );
      }

      setReferrers((prev) =>
        prev.filter((r) => r.name.toLowerCase() !== doctor.name.toLowerCase())
      );

      // Reset selection if active doctor was deleted
      const remaining = referrerSummaries.filter(
        (r) => r.name.toLowerCase() !== doctor.name.toLowerCase()
      );
      setSelectedReferrerName(remaining.length > 0 ? remaining[0].name : '');
      setShowPaymentForm(false);
      setSuccessMsg(`Referrer "${doctor.name}" has been deleted.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Error deleting referrer:', err);
      alert('Failed to delete referrer. Only administrators can delete referrers.');
    } finally {
      setDeletingReferrer(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <AppLayout>
      <OnlineStatus />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-6 print:hidden">
        {/* ─── Page Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
              <UserCheck className="w-6 h-6 text-blue-600" />
              <span>Doctor & Referrer Payments</span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Track referral balances, payouts, and statements
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-shrink-0">
            {activeSummary && (
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-2xs flex-shrink-0 whitespace-nowrap"
                title="Print or Save PDF Statement for active doctor"
              >
                <Printer className="w-4 h-4 text-blue-600" />
                <span>Print / Save PDF</span>
              </button>
            )}
            {activeSummary && (
              <button
                type="button"
                onClick={() => setShowPaymentForm(!showPaymentForm)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm flex-shrink-0 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>{showPaymentForm ? 'Cancel Payment' : 'Adjust / Pay Amount'}</span>
              </button>
            )}
          </div>
        </div>

        {/* ─── Global KPI Stats Bar ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <span>Total Billed</span>
              <Receipt className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-gray-900">
              {formatCurrency(globalStats.totalBilled)}
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">Sum of all referred patient bills</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <span>Total Settled</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-emerald-600">
              {formatCurrency(globalStats.totalSettled)}
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">Direct payments made to date</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <span>Outstanding Due</span>
              <AlertCircle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-amber-600">
              {formatCurrency(globalStats.totalDue)}
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">Pending balance from referrers</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <span>Active Doctors</span>
              <Users className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-gray-900">
              {globalStats.activeDoctors}
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">With referred cases</p>
          </div>
        </div>

        {/* ─── Success Notification ─── */}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl flex items-center gap-2 font-medium animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ─── Main Two-Column Layout ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (4 cols): Doctor Selector List */}
          <div className="lg:col-span-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3.5 border-b border-gray-100 bg-gray-50/70">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchDoctor}
                  onChange={(e) => setSearchDoctor(e.target.value)}
                  placeholder="Search doctor or referrer..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-[600px] divide-y divide-gray-100">
              {loading ? (
                <div className="p-8 text-center text-gray-400 text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Loading doctors...</span>
                </div>
              ) : filteredSummaries.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs">
                  No doctors found matching &quot;{searchDoctor}&quot;.
                </div>
              ) : (
                filteredSummaries.map((doctor) => {
                  const isSelected = activeSummary?.name === doctor.name;
                  return (
                    <div
                      key={doctor.name}
                      onClick={() => {
                        setSelectedReferrerName(doctor.name);
                        setShowPaymentForm(false);
                      }}
                      className={`p-3.5 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50/90 border-l-4 border-blue-600'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-gray-900 truncate">
                          {doctor.name}
                        </span>
                        <span
                          className={`text-xs font-bold ${
                            doctor.balanceDue > 0
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {doctor.balanceDue > 0
                            ? `Due: ${formatCurrency(doctor.balanceDue)}`
                            : 'Settled'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500 mt-1.5">
                        <span>{doctor.patientCount} referred patients</span>
                        <span>Paid: {formatCurrency(doctor.totalPaid)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column (8 cols): Selected Doctor Ledger & Actions */}
          <div className="lg:col-span-8 space-y-4">
            {activeSummary ? (
              <>
                {/* Active Doctor Info Header Card */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-xl font-bold text-gray-900">
                        {activeSummary.name}
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                        {activeSummary.patientCount} Patients
                      </span>
                      {profile?.role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteDoctor(activeSummary)}
                          disabled={deletingReferrer}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ml-1"
                          title="Admin only: Delete referral doctor"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Doctor</span>
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Showing all referred patients, payments, and current balance status
                    </p>
                  </div>

                  <div className="text-left sm:text-right flex-shrink-0 bg-gray-50 sm:bg-transparent p-3 sm:p-0 rounded-lg w-full sm:w-auto">
                    <span className="text-xs text-gray-400 uppercase tracking-wider block font-semibold">
                      Current Due Balance
                    </span>
                    <span
                      className={`text-2xl font-black ${
                        activeSummary.balanceDue > 0
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {formatCurrency(activeSummary.balanceDue)}
                    </span>
                  </div>
                </div>

                {/* ─── Payment Form (When Toggled) ─── */}
                {showPaymentForm && (
                  <form
                    onSubmit={handleAddPayment}
                    className="bg-blue-50/70 p-5 rounded-xl border border-blue-200 shadow-sm space-y-4 animate-in fade-in zoom-in-95 duration-150"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-blue-200">
                      <div>
                        <h3 className="text-sm font-bold text-blue-950">
                          Record Payment to {activeSummary.name}
                        </h3>
                        <p className="text-xs text-blue-700">
                          Entering payment will automatically decrease the doctor&apos;s balance due
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-gray-500">
                        Current Due: {formatCurrency(activeSummary.balanceDue)}
                      </span>
                    </div>

                    {formError && (
                      <div className="p-3 bg-red-100 border border-red-200 text-red-700 text-xs rounded-lg">
                        {formError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Amount to Pay (₹) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                            ₹
                          </span>
                          <input
                            type="number"
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            placeholder="e.g. 1000 or 2000"
                            min="1"
                            className="w-full pl-7 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Payment Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={payDate}
                          onChange={(e) => setPayDate(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Payment Mode
                        </label>
                        <select
                          value={payMode}
                          onChange={(e) => setPayMode(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="Cash">Cash</option>
                          <option value="UPI / GPay / PhonePe">UPI / Online</option>
                          <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                          <option value="Cheque">Cheque</option>
                          <option value="Adjustment / Concession">Adjustment / Discount</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Notes / Reference (Optional)
                      </label>
                      <input
                        type="text"
                        value={payNotes}
                        onChange={(e) => setPayNotes(e.target.value)}
                        placeholder="e.g. Paid in clinic, partial payout for October tests"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex justify-end gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowPaymentForm(false)}
                        className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingPayment}
                        className="px-5 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                      >
                        {savingPayment && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Save Payment
                      </button>
                    </div>
                  </form>
                )}

                {/* ─── Two Tables: Patients and Payments ─── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Table 1: Referred Patients */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between text-xs font-semibold text-gray-700">
                      <span>Referred Patients ({activeSummary.entries.length})</span>
                      <span className="text-gray-900 font-bold">
                        Total Bill: {formatCurrency(activeSummary.totalBilled)}
                      </span>
                    </div>

                    <div className="overflow-y-auto max-h-80 divide-y divide-gray-100 text-xs">
                      {activeSummary.entries.length === 0 ? (
                        <div className="p-6 text-center text-gray-400">
                          No patient entries recorded under this doctor yet.
                        </div>
                      ) : (
                        activeSummary.entries.map((entry) => (
                          <div
                            key={entry.id}
                            className="p-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex-1 min-w-0 pr-3">
                              <div className="font-semibold text-gray-900 truncate">
                                {entry.patientName}
                              </div>
                              <div className="text-[11px] text-gray-400 flex items-center gap-2 mt-0.5">
                                <span>{formatDisplayDate(entry.date)}</span>
                                {entry.tests && entry.tests.length > 0 && (
                                  <span className="truncate max-w-[160px]">
                                    • {entry.tests.map((t) => t.name).join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="font-bold text-gray-900">
                                {formatCurrency(entry.totalAmount)}
                              </div>
                              {Number(entry.referAmount) > 0 && (
                                <div className="text-[10px] text-gray-400">
                                  Ref Comm: {formatCurrency(entry.referAmount)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Table 2: Payment History */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between text-xs font-semibold text-gray-700">
                      <span>Payments & Adjustments ({activeSummary.payments.length})</span>
                      <span className="text-emerald-600 font-bold">
                        Paid: {formatCurrency(activeSummary.totalPaid)}
                      </span>
                    </div>

                    <div className="overflow-y-auto max-h-80 divide-y divide-gray-100 text-xs">
                      {activeSummary.payments.length === 0 ? (
                        <div className="p-6 text-center text-gray-400">
                          No payments recorded yet. Click &quot;Adjust / Pay Amount&quot; to
                          record a payout.
                        </div>
                      ) : (
                        activeSummary.payments.map((p) => (
                          <div
                            key={p.id}
                            className="p-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex-1 min-w-0 pr-2">
                              <div className="font-semibold text-emerald-700 flex items-center gap-2">
                                <span>Paid {formatCurrency(p.amount)}</span>
                                <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 font-normal">
                                  {p.paymentMode || 'Cash'}
                                </span>
                              </div>
                              <div className="text-[11px] text-gray-400 mt-0.5 truncate">
                                {formatDisplayDate(p.date)}
                                {p.notes && ` • ${p.notes}`}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeletePayment(p)}
                              className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                              title="Delete payment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white p-12 rounded-xl border border-gray-200 text-center text-gray-400 text-sm">
                Select a doctor from the list on the left to view their statement and make adjustments.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          DEDICATED PRINT / SAVE PDF STATEMENT (VISIBLE ONLY ON PRINT)
         ═══════════════════════════════════════════════════════════ */}
      {activeSummary && (
        <div
          ref={printRef}
          className="hidden print:block p-8 bg-white text-gray-900 text-sm"
        >
          {/* Header */}
          <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                Accuprobe Diagnostics
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Doctor Referral Statement & Payment Settlement
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Date Generated</div>
              <div className="font-semibold text-sm">
                {formatDisplayDate(getTodayISO())}
              </div>
            </div>
          </div>

          {/* Doctor Info & Summary Box */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-300 mb-6">
            <div className="flex justify-between items-center mb-3">
              <div>
                <span className="text-xs text-gray-500 uppercase tracking-wider block">
                  Doctor / Referrer Name
                </span>
                <span className="text-lg font-bold text-gray-900">
                  {activeSummary.name}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-500 uppercase tracking-wider block">
                  Current Balance Due
                </span>
                <span className="text-xl font-bold text-black">
                  {formatCurrency(activeSummary.balanceDue)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-3 border-t border-gray-200 text-xs">
              <div>
                <span className="text-gray-500 block">Total Patients:</span>
                <span className="font-semibold text-sm">
                  {activeSummary.patientCount}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Total Billed:</span>
                <span className="font-semibold text-sm">
                  {formatCurrency(activeSummary.totalBilled)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Total Paid to Date:</span>
                <span className="font-semibold text-sm">
                  {formatCurrency(activeSummary.totalPaid)}
                </span>
              </div>
            </div>
          </div>

          {/* Table 1: Referred Patients */}
          <div className="mb-6">
            <h3 className="font-bold text-sm mb-2 uppercase tracking-wider text-gray-700">
              1. Referred Patients & Billed Amounts
            </h3>
            <table className="w-full text-xs text-left border border-gray-300">
              <thead className="bg-gray-100 border-b border-gray-300">
                <tr>
                  <th className="p-2 border-r border-gray-300 w-10 text-center">#</th>
                  <th className="p-2 border-r border-gray-300 whitespace-nowrap">Date</th>
                  <th className="p-2 border-r border-gray-300">Patient Name</th>
                  <th className="p-2 border-r border-gray-300">Investigation(s)</th>
                  <th className="p-2 text-right whitespace-nowrap">Bill Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {activeSummary.entries.map((entry, idx) => (
                  <tr key={entry.id}>
                    <td className="p-2 border-r border-gray-300 text-gray-500 text-center">
                      {idx + 1}
                    </td>
                    <td className="p-2 border-r border-gray-300 whitespace-nowrap">
                      {formatDisplayDate(entry.date)}
                    </td>
                    <td className="p-2 border-r border-gray-300 font-medium">
                      {entry.patientName}
                    </td>
                    <td className="p-2 border-r border-gray-300">
                      {entry.tests && entry.tests.length > 0
                        ? entry.tests.map((t) => t.name).join(', ')
                        : '-'}
                    </td>
                    <td className="p-2 text-right font-semibold">
                      {formatCurrency(entry.totalAmount)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
                  <td colSpan={4} className="p-2 text-right">
                    Total Amount Billed:
                  </td>
                  <td className="p-2 text-right">
                    {formatCurrency(activeSummary.totalBilled)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Table 2: Payouts & Settlements */}
          <div className="mb-8">
            <h3 className="font-bold text-sm mb-2 uppercase tracking-wider text-gray-700">
              2. Payments & Settlement History
            </h3>
            <table className="w-full text-xs text-left border border-gray-300">
              <thead className="bg-gray-100 border-b border-gray-300">
                <tr>
                  <th className="p-2 border-r border-gray-300">#</th>
                  <th className="p-2 border-r border-gray-300">Date</th>
                  <th className="p-2 border-r border-gray-300">Payment Mode</th>
                  <th className="p-2 border-r border-gray-300">Notes / Reference</th>
                  <th className="p-2 text-right">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {activeSummary.payments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-2 text-center text-gray-400">
                      No payments recorded yet.
                    </td>
                  </tr>
                ) : (
                  activeSummary.payments.map((pay, idx) => (
                    <tr key={pay.id}>
                      <td className="p-2 border-r border-gray-300 text-gray-500">
                        {idx + 1}
                      </td>
                      <td className="p-2 border-r border-gray-300 whitespace-nowrap">
                        {formatDisplayDate(pay.date)}
                      </td>
                      <td className="p-2 border-r border-gray-300 font-medium">
                        {pay.paymentMode || 'Cash'}
                      </td>
                      <td className="p-2 border-r border-gray-300 text-gray-600">
                        {pay.notes || '-'}
                      </td>
                      <td className="p-2 text-right font-semibold">
                        {formatCurrency(pay.amount)}
                      </td>
                    </tr>
                  ))
                )}
                <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
                  <td colSpan={4} className="p-2 text-right">
                    Total Amount Paid:
                  </td>
                  <td className="p-2 text-right text-black">
                    {formatCurrency(activeSummary.totalPaid)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>


        </div>
      )}
    </AppLayout>
  );
}
