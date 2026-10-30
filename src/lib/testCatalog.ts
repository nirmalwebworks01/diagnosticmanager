// src/lib/testCatalog.ts

import rawTestsData from '@/data/labTests.json';

export interface LabTest {
  id: string;
  name: string;
  code: string;
  rate: number;
  department: string;
}

export const ALL_TESTS: LabTest[] = rawTestsData as LabTest[];

export const ALL_DEPARTMENTS: string[] = Array.from(
  new Set(ALL_TESTS.map((t) => t.department).filter(Boolean))
).sort();

/**
 * Fast search through all 1400+ diagnostic tests.
 * Searches across test name, test code, and department.
 * Scores matches so exact code or name-prefix matches appear at the top.
 */
export function searchTests(
  query: string,
  departmentFilter: string = 'all',
  maxResults: number = 25
): LabTest[] {
  const q = query.trim().toLowerCase();

  let filtered = ALL_TESTS;
  if (departmentFilter && departmentFilter !== 'all') {
    filtered = filtered.filter((t) => t.department === departmentFilter);
  }

  if (!q) {
    return filtered.slice(0, maxResults);
  }

  // Pre-split tokens for multi-word search (e.g. "blood glucose")
  const tokens = q.split(/\s+/).filter(Boolean);

  const scored: { test: LabTest; score: number }[] = [];

  for (const test of filtered) {
    const nameLower = test.name.toLowerCase();
    const codeLower = test.code.toLowerCase();
    const deptLower = test.department.toLowerCase();

    // Check if all tokens match anywhere in name, code, or department
    const allTokensMatch = tokens.every(
      (tok) =>
        nameLower.includes(tok) ||
        codeLower.includes(tok) ||
        deptLower.includes(tok)
    );

    if (!allTokensMatch) continue;

    let score = 0;

    // Exact code match = highest score
    if (codeLower === q) {
      score += 1000;
    } else if (codeLower.startsWith(q)) {
      score += 500;
    } else if (codeLower.includes(q)) {
      score += 200;
    }

    // Exact name match
    if (nameLower === q) {
      score += 800;
    } else if (nameLower.startsWith(q)) {
      score += 400;
    } else if (nameLower.includes(q)) {
      score += 100;
    }

    // Token proximity bonus
    if (nameLower.indexOf(q) !== -1) {
      score += Math.max(0, 50 - nameLower.indexOf(q));
    }

    scored.push({ test, score });
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, maxResults).map((s) => s.test);
}
