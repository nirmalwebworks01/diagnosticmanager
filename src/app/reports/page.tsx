'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import dynamic from 'next/dynamic';
const AppLayout = dynamic(() => import('@/components/AppLayout'), { ssr: false });
import OnlineStatus from '@/components/OnlineStatus';
import { fetchEntriesByDateRange } from '@/lib/firestore';
import { Entry } from '@/lib/types';
import {
  calculateEntry,
  formatCurrency,
  formatDisplayDate,
  getTodayISO,
} from '@/lib/calculations';
import { Loader2, Printer, Download, Search } from 'lucide-react';

export default function ReportsPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [customStart, setCustomStart] = useState(getTodayISO());
  const [customEnd, setCustomEnd] = useState(getTodayISO());
  const [hasGenerated, setHasGenerated] = useState(false);

  async function generateReport() {
    if (!user || !customStart || !customEnd) return;
    setLoading(true);
    try {
      const data = await fetchEntriesByDateRange(customStart, customEnd);
      setEntries(data);
      setHasGenerated(true);
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  }

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

  function exportCSV() {
    if (entries.length === 0) return;
    const headers = ['Date', 'Patient', 'Total', 'Received', 'Due', 'Company', 'Refer By', 'Referral', 'Net Profit'];
    const rows = entries.map((e) => {
      const calc = calculateEntry(e.totalAmount, e.receivedAmount, e.companyAmount, e.referAmount);
      return [
        e.date, // original YYYY-MM-DD
        `"${e.patientName}"`,
        e.totalAmount,
        e.receivedAmount,
        calc.due,
        e.companyAmount,
        `"${e.referBy}"`,
        e.referAmount,
        calc.netProfit
      ].join(',');
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `financial-report-${customStart}-to-${customEnd}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <AppLayout>
      <OnlineStatus />
      
      {/* 
        Tailwind print modifiers will format the layout for A4.
        md:ml-60 is removed on print to use full width. 
      */}
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-8 print:p-0 print:max-w-none">
          
          {/* === SCREEN HEADER & CONTROLS === */}
          <div className="print:hidden mb-6">
            
            <div className="bg-white p-4 md:p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-end gap-4">
              <div className="flex-1 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Date From</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Date To</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <button
                onClick={generateReport}
                disabled={loading}
                className="w-full md:w-auto px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Generate Report
              </button>
            </div>
          </div>

          {hasGenerated && (
            <>
              {/* === REPORT ACTION BUTTONS === */}
              <div className="print:hidden flex items-center justify-end gap-3 mb-6">
                <button
                  onClick={exportCSV}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" /> Print Report
                </button>
              </div>

              {/* === REPORT DOCUMENT CONTAINER === */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:border-0 print:shadow-none">
                
                {/* Formal Document Header */}
                <div className="px-6 py-5 border-b border-gray-200 bg-gray-50/50 print:bg-white print:border-b-2 print:border-black">
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight">Financial Report</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Statement Period: <span className="font-medium text-gray-700">{formatDisplayDate(customStart)}</span> to <span className="font-medium text-gray-700">{formatDisplayDate(customEnd)}</span>
                  </p>
                </div>

                {/* === COMPACT LEDGER SUMMARY === */}
                <div className="p-6 border-b border-gray-200 print:border-0">
                  <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">Summary Totals</h3>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500 text-xs mb-0.5">Total Billing</div>
                      <div className="font-semibold text-blue-600 text-base">{formatCurrency(summary.billing)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs mb-0.5">Received</div>
                      <div className="font-semibold text-emerald-600 text-base">{formatCurrency(summary.received)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs mb-0.5">Outstanding</div>
                      <div className="font-semibold text-amber-600 text-base">{formatCurrency(summary.outstanding)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs mb-0.5">Company Payable</div>
                      <div className="font-semibold text-purple-600 text-base">{formatCurrency(summary.company)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs mb-0.5">Referrals Paid</div>
                      <div className="font-semibold text-pink-600 text-base">{formatCurrency(summary.referral)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs mb-0.5">Net Profit</div>
                      <div className={`font-bold text-base ${summary.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(summary.profit)}</div>
                    </div>
                  </div>
                </div>

              {/* === REPORT TABLE (ALL SCREENS) === */}
              <div className="bg-white">
                <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 print:bg-white print:border-b-2 print:border-black text-gray-600 font-medium text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 print:py-2 print:px-2">Date</th>
                        <th className="px-4 py-3 print:py-2 print:px-2">Patient</th>
                        <th className="px-4 py-3 print:py-2 print:px-2 text-right">Total</th>
                        <th className="px-4 py-3 print:py-2 print:px-2 text-right">Received</th>
                        <th className="px-4 py-3 print:py-2 print:px-2 text-right">Due</th>
                        <th className="px-4 py-3 print:py-2 print:px-2 text-right">Company</th>
                        <th className="px-4 py-3 print:py-2 print:px-2">Refer By</th>
                        <th className="px-4 py-3 print:py-2 print:px-2 text-right">Referral</th>
                        <th className="px-4 py-3 print:py-2 print:px-2 text-right">Net Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 print:divide-gray-300">
                      {entries.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                            No entries found for the selected date range.
                          </td>
                        </tr>
                      ) : (
                        entries.map(entry => {
                          const calc = calculateEntry(entry.totalAmount, entry.receivedAmount, entry.companyAmount, entry.referAmount);
                          return (
                            <tr key={entry.id} className="hover:bg-gray-50 print:hover:bg-white transition-colors">
                              <td className="px-4 py-2.5 print:py-1.5 print:px-2 text-gray-600 whitespace-nowrap">{formatDisplayDate(entry.date)}</td>
                              <td className="px-4 py-2.5 print:py-1.5 print:px-2 font-medium text-gray-900">{entry.patientName}</td>
                              <td className="px-4 py-2.5 print:py-1.5 print:px-2 text-right text-gray-800">{formatCurrency(entry.totalAmount)}</td>
                              <td className="px-4 py-2.5 print:py-1.5 print:px-2 text-right text-gray-600">{formatCurrency(entry.receivedAmount)}</td>
                              <td className="px-4 py-2.5 print:py-1.5 print:px-2 text-right font-medium text-amber-600 print:text-black">{formatCurrency(calc.due)}</td>
                              <td className="px-4 py-2.5 print:py-1.5 print:px-2 text-right text-gray-600">{formatCurrency(entry.companyAmount)}</td>
                              <td className="px-4 py-2.5 print:py-1.5 print:px-2 text-gray-600">{entry.referBy}</td>
                              <td className="px-4 py-2.5 print:py-1.5 print:px-2 text-right text-gray-600">{formatCurrency(entry.referAmount)}</td>
                              <td className={`px-4 py-2.5 print:py-1.5 print:px-2 text-right font-bold ${calc.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'} print:text-black`}>
                                {formatCurrency(calc.netProfit)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              
              </div> {/* END OF REPORT DOCUMENT CONTAINER */}
              
            </>
          )}
        </div>
    </AppLayout>
  );
}
