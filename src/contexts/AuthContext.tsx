// src/contexts/AuthContext.tsx
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile } from '@/lib/types';
import { clearAllCaches } from '@/lib/firestore';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
});

const PROFILE_CACHE_KEY = 'dm_cached_profile';

function getCachedProfile(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCachedProfile(profile: UserProfile | null) {
  if (typeof window === 'undefined') return;
  try {
    if (profile) {
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
    } else {
      localStorage.removeItem(PROFILE_CACHE_KEY);
    }
  } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(getCachedProfile);
  const cachedProfile = getCachedProfile();
  const [loading, setLoading] = useState(!cachedProfile);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        // Set user immediately
        setUser(authUser);

        // If we have a cached profile for this user, stop loading RIGHT NOW
        const cached = getCachedProfile();
        if (cached && cached.uid === authUser.uid && cached.active) {
          setProfile(cached);
          setLoading(false);
        }

        // Always fetch fresh profile from server (silently in background)
        try {
          const docRef = doc(db, 'users', authUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            if (!data.active) {
              await signOut(auth);
              setCachedProfile(null);
              alert("Your account has been disabled. Please contact the administrator.");
              setUser(null);
              setProfile(null);
            } else {
              setUser(authUser);
              setProfile(data);
              setCachedProfile(data);
            }
          } else {
            setUser(authUser);
            setProfile(null);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          if (!cached) {
            setUser(null);
            setProfile(null);
          }
        }
      } else {
        setUser(null);
        setProfile(null);
        setCachedProfile(null);
        clearAllCaches();
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

