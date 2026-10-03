// src/lib/firestore.ts

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  where,
  Timestamp,
  setDoc,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { Entry, Referrer, UserProfile, LogAction, ActivityLog } from './types';

const entriesCollection = collection(db, 'entries');
const referrersCollection = collection(db, 'referrers');
const usersCollection = collection(db, 'users');

// ──────────────────────────────────────────────
// ENTRIES
// ──────────────────────────────────────────────

export async function addEntry(
  entry: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = new Date().toISOString();
  const docRef = await addDoc(entriesCollection, {
    ...entry,
    createdAt: now,
    updatedAt: now,
  });
  clearEntriesCache();
  return docRef.id;
}

export async function updateEntry(
  id: string,
  entry: Partial<Omit<Entry, 'id' | 'createdAt'>>,
  userId: string
): Promise<void> {
  const docRef = doc(db, 'entries', id);
  await updateDoc(docRef, {
    ...entry,
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  });
  clearEntriesCache();
}

export async function deleteEntry(id: string): Promise<void> {
  const docRef = doc(db, 'entries', id);
  await deleteDoc(docRef);
  clearEntriesCache();
}

let entriesCache: Entry[] | null = null;
let entriesCacheTime = 0;
const ENTRIES_CACHE_KEY = 'dm_entries_date_cache';

function getPersistedDateCache(): Record<string, { data: Entry[], time: number }> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ENTRIES_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistDateCache(cache: Record<string, { data: Entry[], time: number }>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ENTRIES_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

const entriesByDateCache: Record<string, { data: Entry[], time: number }> = getPersistedDateCache();
const CACHE_DURATION = 60000; // 1 minute

export function clearEntriesCache() {
  entriesCache = null;
  for (const key in entriesByDateCache) delete entriesByDateCache[key];
  if (typeof window !== 'undefined') localStorage.removeItem(ENTRIES_CACHE_KEY);
}

// Synchronous cache getters — pages use these for instant initial render
export function getCachedEntries(): Entry[] | null {
  if (entriesCache && (Date.now() - entriesCacheTime < CACHE_DURATION)) {
    return entriesCache;
  }
  return null;
}

export function getCachedEntriesByDateRange(startDate: string, endDate: string): Entry[] | null {
  const key = `${startDate}_${endDate}`;
  const cached = entriesByDateCache[key];
  if (cached && (Date.now() - cached.time < CACHE_DURATION)) {
    return cached.data;
  }
  return null;
}

export async function fetchEntries(limitCount = 500, forceRefresh = false): Promise<Entry[]> {
  const now = Date.now();
  if (!forceRefresh && entriesCache && (now - entriesCacheTime < CACHE_DURATION)) {
    return entriesCache;
  }

  const q = query(
    entriesCollection,
    orderBy('date', 'desc'),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Entry[];
  
  entriesCache = data;
  entriesCacheTime = now;
  return data;
}

export async function fetchEntriesByDateRange(
  startDate: string,
  endDate: string,
  forceRefresh = false
): Promise<Entry[]> {
  const cacheKey = `${startDate}_${endDate}`;
  const now = Date.now();
  if (!forceRefresh && entriesByDateCache[cacheKey] && (now - entriesByDateCache[cacheKey].time < CACHE_DURATION)) {
    return entriesByDateCache[cacheKey].data;
  }

  const q = query(
    entriesCollection,
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'desc')
  );
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Entry[];

  entriesByDateCache[cacheKey] = { data, time: now };
  persistDateCache(entriesByDateCache);
  return data;
}

// ──────────────────────────────────────────────
// REFERRERS
// ──────────────────────────────────────────────

export async function addReferrer(
  name: string,
  userId: string
): Promise<string> {
  const docRef = await addDoc(referrersCollection, {
    name,
    createdAt: new Date().toISOString(),
    createdBy: userId,
  });
  return docRef.id;
}

let referrersCache: Referrer[] | null = null;
let referrersCacheTime = 0;

export async function fetchReferrers(forceRefresh = false): Promise<Referrer[]> {
  const now = Date.now();
  if (!forceRefresh && referrersCache && (now - referrersCacheTime < 60000)) {
    return referrersCache; // Cache for 1 minute
  }

  const q = query(
    referrersCollection,
    orderBy('name', 'asc')
  );
  const snapshot = await getDocs(q);
  referrersCache = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Referrer[];
  referrersCacheTime = now;
  return referrersCache;
}

// ─── USER MANAGEMENT ───

export async function fetchUsers(): Promise<UserProfile[]> {
  const q = query(usersCollection, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as UserProfile);
}

let userMapCache: Record<string, string> | null = null;
let userMapCacheTime = 0;

export async function fetchUserMap(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && userMapCache && (now - userMapCacheTime < 60000)) {
    return userMapCache;
  }

  const users = await fetchUsers();
  userMapCache = users.reduce((acc, user) => {
    acc[user.uid] = user.name;
    return acc;
  }, {} as Record<string, string>);
  userMapCacheTime = now;
  
  return userMapCache;
}

export async function updateUserStatus(uid: string, active: boolean): Promise<void> {
  const docRef = doc(db, 'users', uid);
  await updateDoc(docRef, { active, updatedAt: new Date().toISOString() });
}

export async function addUserProfile(profile: UserProfile): Promise<void> {
  const docRef = doc(db, 'users', profile.uid);
  await setDoc(docRef, profile);
}

// ─── ACTIVITY LOGS ───

export async function logActivity(action: LogAction, details: string, profile: UserProfile) {
  try {
    const logsRef = collection(db, 'logs');
    const newLog: Omit<ActivityLog, 'id'> = {
      action,
      details,
      userId: profile.uid,
      userName: profile.name || 'Unknown User',
      userEmail: profile.email,
      timestamp: new Date().toISOString(),
    };
    await addDoc(logsRef, newLog);
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

export async function getRecentLogs(limitCount = 100): Promise<ActivityLog[]> {
  const logsRef = collection(db, 'logs');
  const q = query(logsRef, orderBy('timestamp', 'desc'), limit(limitCount));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
}
