'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import Pagination from '@/components/Pagination';
import OnlineStatus from '@/components/OnlineStatus';
import { fetchEntriesByDateRange, getCachedEntriesByDateRange } from '@/lib/firestore';
import { Entry } from '@/lib/types';
import {
  calculateEntry,
  formatCurrency,
  formatDisplayDate,
  DateFilterType,
  getDateRange,
  getTodayISO,
} from '@/lib/calculations';
import { Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';



export default function DashboardPage() {
  const { user } = useAuth();

  // Compute initial date range synchronously
  const initRange = getDateRange('today');
  const initCached = getCachedEntriesByDateRange(initRange.start, initRange.end);

  const [entries, setEntries] = useState<Entry[]>(initCached || []);
  const [loading, setLoading] = useState(!initCached);
  const [filterType, setFilterType] = useState<DateFilterType>('today');
  const [customStart, setCustomStart] = useState(getTodayISO());
  const [customEnd, setCustomEnd] = useState(getTodayISO());
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    async function load() {
      try {
        let start = '';
        let end = '';
        if (filterType === 'custom') {
          start = customStart;
          end = customEnd;
        } else {
          const range = getDateRange(filterType);
          start = range.start;
          end = range.end;
        }
        
        if (start && end) {
          // Check if we already have this data from cache (skip spinner)
          const cached = getCachedEntriesByDateRange(start, end);
          if (cached) {
            if (isMounted) {
              setEntries(cached);
              setLoading(false);
            }
          } else {
            if (isMounted) setLoading(true);
          }

          const data = await fetchEntriesByDateRange(start, end);
          if (isMounted) setEntries(data);
        }
      } catch (error) {
        console.error('Error fetching dashboard entries:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => { isMounted = false; };
  }, [user, filterType, customStart, customEnd]);

  useEffect(() => {
    setCurrentPage(1); // Reset page on filter change
  }, [filterType, customStart, customEnd]);

  const summary = useMemo(() => {
    let billing = 0;
    let received = 0;
    let outstanding = 0;
    let company = 0;
    let referral = 0;
    let profit = 0;

    entries.forEach((e) => {
      const calc = calculateEntry(e.totalAmount, e.receivedAmount, e.companyAmount, e.referAmount);
      billing += Number(e.totalAmount) || 0;
      received += Number(e.receivedAmount) || 0;
      outstanding += calc.due;
      company += Number(e.companyAmount) || 0;
      referral += Number(e.referAmount) || 0;
      profit += calc.netProfit;
    });

    return { billing, received, outstanding, company, referral, profit };
  }, [entries]);

  const paginatedEntries = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return entries.slice(startIndex, startIndex + itemsPerPage);
  }, [entries, currentPage]);

  // Remove hard slice to use paginatedEntries
  const dueEntries = entries.filter((e) => {
    const calc = calculateEntry(e.totalAmount, e.receivedAmount, e.companyAmount, e.referAmount);
    return calc.due > 0;
  }).slice(0, 5);

  const filterOptions: { label: string; value: DateFilterType }[] = [
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'This Week', value: 'thisWeek' },
    { label: 'This Month', value: 'thisMonth' },
    { label: 'Custom', value: 'custom' },
  ];

  return (
    <AppLayout>
      <OnlineStatus />
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">
          {/* Header Removed as requested */}
          {/* Filters */}
          <div className="mb-6">
            <div className="flex flex-wrap gap-2 mb-3">
              {filterOptions.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilterType(f.value)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    filterType === f.value
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {filterType === 'custom' && (
              <div className="flex items-center gap-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-xs uppercase tracking-widest font-medium">Loading Dashboard...</span>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-8">
                <SummaryCard title="Total Billing" amount={summary.billing} color="text-blue-600" bg="bg-blue-50" />
                <SummaryCard title="Total Received" amount={summary.received} color="text-emerald-600" bg="bg-emerald-50" />
                <SummaryCard title="Patient Outstanding" amount={summary.outstanding} color="text-amber-600" bg="bg-amber-50" />
                <SummaryCard title="Company Payable" amount={summary.company} color="text-purple-600" bg="bg-purple-50" />
                <SummaryCard title="Referral Paid" amount={summary.referral} color="text-pink-600" bg="bg-pink-50" />
                <SummaryCard title="Net Profit" amount={summary.profit} color={summary.profit >= 0 ? "text-emerald-600" : "text-red-600"} bg={summary.profit >= 0 ? "bg-emerald-50" : "bg-red-50"} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Entries */}
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                      <h2 className="font-bold text-gray-900">Recent Entries</h2>
                      <Link href="/entries" className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
                        View All <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                    
                    <div className="divide-y divide-gray-100">
                      {paginatedEntries.length === 0 ? (
                        <div className="p-6 text-center text-sm text-gray-500">No transactions for this period.</div>
                      ) : (
                        paginatedEntries.map(entry => {
                          const calc = calculateEntry(entry.totalAmount, entry.receivedAmount, entry.companyAmount, entry.referAmount);
                          return (
                            <div key={entry.id} className="py-2.5 px-4 flex items-center justify-between gap-2 hover:bg-gray-50 transition-colors">
                              <div>
                                <h3 className="text-sm font-semibold text-gray-900 leading-tight">{entry.patientName}</h3>
                                <p className="text-[11px] text-gray-500 mt-0.5">{formatDisplayDate(entry.date)}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-right">
                                <div><span className="text-gray-400">Total: </span><span className="font-medium text-gray-700">{formatCurrency(entry.totalAmount)}</span></div>
                                <div><span className="text-gray-400">Received: </span><span className="text-gray-600">{formatCurrency(entry.receivedAmount)}</span></div>
                                <div><span className="text-gray-400">Due: </span><span className={`font-medium ${calc.due > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{formatCurrency(calc.due)}</span></div>
                                <div><span className="text-gray-400">Profit: </span><span className={`font-semibold ${calc.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(calc.netProfit)}</span></div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    
                    {!loading && entries.length > 0 && (
                      <Pagination
                        currentPage={currentPage}
                        totalItems={entries.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                      />
                    )}
                  </div>
                </div>

                {/* Due Patients */}
                <div className="lg:col-span-1">
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                      <h2 className="font-bold text-gray-900">Outstanding</h2>
                      <Link href="/entries" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                        View All
                      </Link>
                    </div>
                    
                    <div className="divide-y divide-gray-100">
                      {dueEntries.length === 0 ? (
                        <div className="p-6 text-center text-sm text-gray-500">No outstanding amounts in this period.</div>
                      ) : (
                        dueEntries.map(entry => {
                          const calc = calculateEntry(entry.totalAmount, entry.receivedAmount, entry.companyAmount, entry.referAmount);
                          return (
                            <div key={entry.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                              <div>
                                <h3 className="font-semibold text-gray-900 text-sm">{entry.patientName}</h3>
                              </div>
                              <div className="font-semibold text-amber-600 text-sm">
                                {formatCurrency(calc.due)}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
    </AppLayout>
  );
}

function SummaryCard({ title, amount, color, bg }: { title: string; amount: number; color: string; bg: string }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center">
      <h3 className="text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5 whitespace-nowrap">{title}</h3>
      <div className={`text-lg md:text-xl font-bold ${color}`}>
        {formatCurrency(amount)}
      </div>
    </div>
  );
}
