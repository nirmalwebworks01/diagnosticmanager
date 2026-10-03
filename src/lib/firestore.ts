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
  clearAllCaches();
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
  clearAllCaches();
}

export async function deleteEntry(id: string): Promise<void> {
  const docRef = doc(db, 'entries', id);
  await deleteDoc(docRef);
  clearAllCaches();
}

function getLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch { return fallback; }
}

function setLocal<T>(key: string, data: T) {
  if (typeof window !== 'undefined') {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
  }
}

const ENTRIES_CACHE_KEY = 'dm_entries_date_cache';
const ENTRIES_ALL_CACHE_KEY = 'dm_entries_all_cache';
const REFERRERS_CACHE_KEY = 'dm_referrers_cache';
const USER_MAP_CACHE_KEY = 'dm_user_map_cache';
const USERS_CACHE_KEY = 'dm_users_cache';
const LOGS_CACHE_KEY = 'dm_logs_cache';
const CACHE_DURATION = 60000; // 1 minute

const persistedEntries = getLocal<{ data: Entry[], time: number } | null>(ENTRIES_ALL_CACHE_KEY, null);
let entriesCache: Entry[] | null = persistedEntries ? persistedEntries.data : null;
let entriesCacheTime = persistedEntries ? persistedEntries.time : 0;

const entriesByDateCache: Record<string, { data: Entry[], time: number }> = getLocal(ENTRIES_CACHE_KEY, {});

export function clearAllCaches() {
  entriesCache = null;
  for (const key in entriesByDateCache) delete entriesByDateCache[key];
  referrersCache = null;
  userMapCache = null;
  usersCache = null;
  logsCache = null;

  if (typeof window !== 'undefined') {
    [ENTRIES_CACHE_KEY, ENTRIES_ALL_CACHE_KEY, REFERRERS_CACHE_KEY, USER_MAP_CACHE_KEY, USERS_CACHE_KEY, LOGS_CACHE_KEY]
      .forEach(k => localStorage.removeItem(k));
  }
}

// Synchronous cache getters — pages use these for instant initial render
export function getCachedEntries(): Entry[] | null {
  return (entriesCache && (Date.now() - entriesCacheTime < CACHE_DURATION)) ? entriesCache : null;
}

export function getCachedEntriesByDateRange(startDate: string, endDate: string): Entry[] | null {
  const cached = entriesByDateCache[`${startDate}_${endDate}`];
  return (cached && (Date.now() - cached.time < CACHE_DURATION)) ? cached.data : null;
}

export async function fetchEntries(limitCount = 500, forceRefresh = false): Promise<Entry[]> {
  const now = Date.now();
  if (!forceRefresh && entriesCache && (now - entriesCacheTime < CACHE_DURATION)) return entriesCache;

  const snapshot = await getDocs(query(entriesCollection, orderBy('date', 'desc'), limit(limitCount)));
  entriesCache = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Entry[];
  entriesCacheTime = now;
  setLocal(ENTRIES_ALL_CACHE_KEY, { data: entriesCache, time: now });
  return entriesCache;
}

export async function fetchEntriesByDateRange(startDate: string, endDate: string, forceRefresh = false): Promise<Entry[]> {
  const key = `${startDate}_${endDate}`;
  const now = Date.now();
  if (!forceRefresh && entriesByDateCache[key] && (now - entriesByDateCache[key].time < CACHE_DURATION)) {
    return entriesByDateCache[key].data;
  }

  const snapshot = await getDocs(query(entriesCollection, where('date', '>=', startDate), where('date', '<=', endDate), orderBy('date', 'desc')));
  const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Entry[];

  entriesByDateCache[key] = { data, time: now };
  setLocal(ENTRIES_CACHE_KEY, entriesByDateCache);
  return data;
}

// ──────────────────────────────────────────────
// REFERRERS
// ──────────────────────────────────────────────

export async function addReferrer(name: string, userId: string): Promise<string> {
  return (await addDoc(referrersCollection, { name, createdAt: new Date().toISOString(), createdBy: userId })).id;
}

const persistedReferrers = getLocal<{ data: Referrer[], time: number } | null>(REFERRERS_CACHE_KEY, null);
let referrersCache: Referrer[] | null = persistedReferrers ? persistedReferrers.data : null;
let referrersCacheTime = persistedReferrers ? persistedReferrers.time : 0;

export function getCachedReferrers(): Referrer[] | null {
  return (referrersCache && (Date.now() - referrersCacheTime < CACHE_DURATION)) ? referrersCache : null;
}

export async function fetchReferrers(forceRefresh = false): Promise<Referrer[]> {
  const now = Date.now();
  if (!forceRefresh && referrersCache && (now - referrersCacheTime < CACHE_DURATION)) return referrersCache;

  const snapshot = await getDocs(query(referrersCollection, orderBy('name', 'asc')));
  referrersCache = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Referrer[];
  referrersCacheTime = now;
  setLocal(REFERRERS_CACHE_KEY, { data: referrersCache, time: now });
  return referrersCache;
}

// ─── USER MANAGEMENT ───

const persistedUsers = getLocal<{ data: UserProfile[], time: number } | null>(USERS_CACHE_KEY, null);
let usersCache: UserProfile[] | null = persistedUsers ? persistedUsers.data : null;
let usersCacheTime = persistedUsers ? persistedUsers.time : 0;

export function getCachedUsers(): UserProfile[] | null {
  return (usersCache && (Date.now() - usersCacheTime < CACHE_DURATION)) ? usersCache : null;
}

export async function fetchUsers(forceRefresh = false): Promise<UserProfile[]> {
  const now = Date.now();
  if (!forceRefresh && usersCache && (now - usersCacheTime < CACHE_DURATION)) return usersCache;

  const snapshot = await getDocs(query(usersCollection, orderBy('createdAt', 'desc')));
  usersCache = snapshot.docs.map((doc) => doc.data() as UserProfile);
  usersCacheTime = now;
  setLocal(USERS_CACHE_KEY, { data: usersCache, time: now });
  return usersCache;
}

const persistedUserMap = getLocal<{ data: Record<string, string>, time: number } | null>(USER_MAP_CACHE_KEY, null);
let userMapCache: Record<string, string> | null = persistedUserMap ? persistedUserMap.data : null;
let userMapCacheTime = persistedUserMap ? persistedUserMap.time : 0;

export function getCachedUserMap(): Record<string, string> | null {
  return (userMapCache && (Date.now() - userMapCacheTime < CACHE_DURATION)) ? userMapCache : null;
}

export async function fetchUserMap(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && userMapCache && (now - userMapCacheTime < CACHE_DURATION)) return userMapCache;

  const users = await fetchUsers();
  userMapCache = users.reduce((acc, user) => { acc[user.uid] = user.name; return acc; }, {} as Record<string, string>);
  userMapCacheTime = now;
  setLocal(USER_MAP_CACHE_KEY, { data: userMapCache, time: now });
  return userMapCache;
}

export async function updateUserStatus(uid: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { active, updatedAt: new Date().toISOString() });
}

export async function addUserProfile(profile: UserProfile): Promise<void> {
  await setDoc(doc(db, 'users', profile.uid), profile);
}

// ─── ACTIVITY LOGS ───

export async function logActivity(action: LogAction, details: string, profile: UserProfile) {
  try {
    await addDoc(collection(db, 'logs'), {
      action, details, userId: profile.uid, userName: profile.name || 'Unknown User',
      userEmail: profile.email, timestamp: new Date().toISOString(),
    });
  } catch (error) { console.error('Failed to log activity:', error); }
}

const persistedLogs = getLocal<{ data: ActivityLog[], time: number } | null>(LOGS_CACHE_KEY, null);
let logsCache: ActivityLog[] | null = persistedLogs ? persistedLogs.data : null;
let logsCacheTime = persistedLogs ? persistedLogs.time : 0;

export function getCachedLogs(): ActivityLog[] | null {
  return (logsCache && (Date.now() - logsCacheTime < CACHE_DURATION)) ? logsCache : null;
}

export async function getRecentLogs(limitCount = 100, forceRefresh = false): Promise<ActivityLog[]> {
  const now = Date.now();
  if (!forceRefresh && logsCache && logsCache.length >= limitCount && (now - logsCacheTime < CACHE_DURATION)) {
    return logsCache.slice(0, limitCount);
  }

  const snapshot = await getDocs(query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(limitCount)));
  logsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
  logsCacheTime = now;
  setLocal(LOGS_CACHE_KEY, { data: logsCache, time: now });
  return logsCache;
}
