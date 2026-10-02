// src/lib/calculations.ts

import { EntryCalculations } from './types';

/**
 * Calculate Patient Due, Gross Profit, and Net Profit.
 *
 * Patient Due = Total Amount - Received Amount
 * Gross Profit = Total Amount - Company Amount
 * Net Profit = Total Amount - Company Amount - Refer Amount
 *
 * IMPORTANT: Received Amount does NOT affect profit calculations.
 * Due and Profit are independent concepts.
 */
export function calculateEntry(
  totalAmount: number,
  receivedAmount: number,
  companyAmount: number,
  referAmount: number
): EntryCalculations {
  const total = Number(totalAmount) || 0;
  const received = Number(receivedAmount) || 0;
  const company = Number(companyAmount) || 0;
  const refer = Number(referAmount) || 0;

  return {
    due: total - received,
    grossProfit: total - company,
    netProfit: total - company - refer,
  };
}

/**
 * Format a number as Indian Rupee currency string.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a date string (YYYY-MM-DD) to display format (DD MMM YYYY).
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Get today's date in YYYY-MM-DD format.
 */
export function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export type DateFilterType = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'custom';

export function getDateRange(filter: DateFilterType): { start: string; end: string } {
  const now = new Date();
  
  const toISODate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = toISODate(now);

  if (filter === 'today') {
    return { start: todayStr, end: todayStr };
  }
  
  if (filter === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = toISODate(yesterday);
    return { start: yStr, end: yStr };
  }
  
  if (filter === 'thisWeek') {
    const startOfWeek = new Date(now);
    // Assuming Monday is start of week
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    return { start: toISODate(startOfWeek), end: todayStr };
  }
  
  if (filter === 'thisMonth') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: toISODate(startOfMonth), end: todayStr };
  }
  
  return { start: todayStr, end: todayStr };
}
