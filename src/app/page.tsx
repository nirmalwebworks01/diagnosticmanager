// src/app/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function HomePage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If we have a cached profile, redirect immediately without waiting for Firebase
    if (profile) {
      router.replace('/dashboard');
      return;
    }
    // Otherwise wait for auth to resolve
    if (!loading) {
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, profile, loading, router]);

  // Show absolutely nothing - the redirect happens in milliseconds
  return null;
}
