// src/components/TestSearchSelector.tsx
'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { LabTest, ALL_DEPARTMENTS, searchTests } from '@/lib/testCatalog';
import { SelectedTest } from '@/lib/types';
import { Search, X, Plus, Trash2, Check, ChevronDown, Sparkles } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';

interface TestSearchSelectorProps {
  selectedTests: SelectedTest[];
  onChange: (tests: SelectedTest[]) => void;
  onTotalAmountChange?: (newTotal: number) => void;
}

export default function TestSearchSelector({
  selectedTests,
  onChange,
  onTotalAmountChange,
}: TestSearchSelectorProps) {
  const [query, setQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filtered search results
  const searchResults = useMemo(() => {
    return searchTests(query, selectedDept, 30);
  }, [query, selectedDept]);

  // Selected test IDs set for fast check
  const selectedKeys = useMemo(() => {
    const keys = new Set<string>();
    selectedTests.forEach((t) => {
      keys.add(`${t.code || ''}-${t.name}`.toLowerCase());
    });
    return keys;
  }, [selectedTests]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);


  // Scroll active item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  function handleSelectTest(test: LabTest) {
    const newTest: SelectedTest = {
      id: test.id,
      name: test.name,
      code: test.code,
      rate: test.rate,
      department: test.department,
    };

    const updated = [...selectedTests, newTest];
    onChange(updated);

    // Update form's total amount
    if (onTotalAmountChange) {
      const newTotal = updated.reduce((sum, t) => sum + (Number(t.rate) || 0), 0);
      onTotalAmountChange(newTotal);
    }

    // Keep dropdown open but clear query or keep input focused for fast multi-add
    setQuery('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }

  function handleRemoveTest(index: number) {
    const updated = selectedTests.filter((_, i) => i !== index);
    onChange(updated);
    if (onTotalAmountChange) {
      const newTotal = updated.reduce((sum, t) => sum + (Number(t.rate) || 0), 0);
      onTotalAmountChange(newTotal);
    }
  }

  function handleRateChange(index: number, newRate: number) {
    const updated = [...selectedTests];
    updated[index] = { ...updated[index], rate: Math.max(0, newRate) };
    onChange(updated);
    if (onTotalAmountChange) {
      const newTotal = updated.reduce((sum, t) => sum + (Number(t.rate) || 0), 0);
      onTotalAmountChange(newTotal);
    }
  }

  function handleClearAll() {
    onChange([]);
    if (onTotalAmountChange) {
      onTotalAmountChange(0);
    }
  }

  const testsTotal = useMemo(() => {
    return selectedTests.reduce((sum, t) => sum + (Number(t.rate) || 0), 0);
  }, [selectedTests]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      return;
    }

    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < searchResults.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : searchResults.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults[highlightedIndex]) {
        handleSelectTest(searchResults[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }

  return (
    <div className="space-y-3" ref={containerRef}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span>Tests & Investigations</span>
          <span className="text-xs font-normal text-gray-500">
            (Search from 1,450+ tests)
          </span>
        </label>
        {selectedTests.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs text-red-500 hover:text-red-700 transition-colors"
          >
            Clear tests
          </button>
        )}
      </div>

      {/* ─── Search & Department Filter ─── */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
                setHighlightedIndex(0);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder="Search by test name (e.g. CBC, Glucose) or code (e.g. C101)..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setHighlightedIndex(0);
                  inputRef.current?.focus();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Department filter */}
          <div className="relative w-40 sm:w-56 flex-shrink-0">
            <select
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setIsOpen(true);
                setHighlightedIndex(0);
              }}
              className="w-full px-2.5 py-2 pr-7 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none truncate"
            >
              <option value="all">All Departments</option>
              {ALL_DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* ─── Search Results Dropdown ─── */}
        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden max-h-84 sm:max-h-96 flex flex-col animate-in fade-in zoom-in-95 duration-100">
            <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
              <span className="truncate pr-2">
                {searchResults.length === 0
                  ? 'No matching tests found'
                  : `Showing ${searchResults.length} matches (click or press Enter to add)`}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] text-gray-400 hidden sm:inline">Esc to close</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                  }}
                  className="p-1 -mr-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200/70 rounded transition-colors"
                  title="Close test list"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div
              ref={listRef}
              className="overflow-y-auto flex-1 divide-y divide-gray-50"
            >
              {searchResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-500">
                  No tests found matching &quot;{query}&quot;. Try another name or
                  clear the department filter.
                </div>
              ) : (
                searchResults.map((test, idx) => {
                  const isSelected = selectedKeys.has(
                    `${test.code || ''}-${test.name}`.toLowerCase()
                  );
                  const isHighlighted = idx === highlightedIndex;

                  return (
                    <div
                      key={test.id}
                      onClick={() => handleSelectTest(test)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`px-3 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isHighlighted
                          ? 'bg-blue-50/80 text-blue-900'
                          : 'hover:bg-gray-50 text-gray-800'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">
                            {test.name}
                          </span>
                          {test.code && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                              {test.code}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 truncate mt-0.5">
                          {test.department}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        <div className="text-right">
                          <div className="text-sm font-bold text-emerald-600">
                            {formatCurrency(test.rate)}
                          </div>
                        </div>

                        <button
                          type="button"
                          className={`p-1 rounded-md text-xs font-medium transition-colors ${
                            isSelected
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white'
                          }`}
                          title={isSelected ? 'Add another' : 'Add test'}
                        >
                          {isSelected ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Selected Tests List ─── */}
      {selectedTests.length > 0 && (
        <div className="bg-blue-50/40 rounded-xl p-3 border border-blue-100 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-700 pb-1 border-b border-blue-100/60">
            <span className="flex items-center gap-1.5">
              <span>Selected Tests</span>
              <span className="px-1.5 py-0.2 bg-blue-600 text-white rounded-full text-[10px] font-bold">
                {selectedTests.length}
              </span>
            </span>
            <span className="text-blue-700 font-bold">
              Subtotal: {formatCurrency(testsTotal)}
            </span>
          </div>

          <div className="space-y-1.5 max-h-60 sm:max-h-72 overflow-y-auto pr-1">
            {selectedTests.map((test, index) => (
              <div
                key={`${test.code}-${test.name}-${index}`}
                className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-gray-200 shadow-xs text-xs"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-gray-900 truncate">
                      {test.name}
                    </span>
                    {test.code && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-gray-100 text-gray-600 flex-shrink-0">
                        {test.code}
                      </span>
                    )}
                  </div>
                  {test.department && (
                    <div className="text-[10px] text-gray-400 truncate">
                      {test.department}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">₹</span>
                    <input
                      type="number"
                      value={test.rate}
                      min="0"
                      onChange={(e) =>
                        handleRateChange(index, Number(e.target.value) || 0)
                      }
                      className="w-16 px-1.5 py-1 text-right font-medium text-gray-800 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50"
                      title="Adjust individual rate if required"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveTest(index)}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Remove test"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1 text-[11px] text-gray-500">
            <span>Rates automatically sync to Total Amount</span>
            {onTotalAmountChange && (
              <button
                type="button"
                onClick={() => onTotalAmountChange(testsTotal)}
                className="text-blue-600 hover:underline font-medium"
              >
                Reset Total to ₹{testsTotal}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
