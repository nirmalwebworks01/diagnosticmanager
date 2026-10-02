// src/components/ProtectedRoute.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import PremiumLoader from '@/components/PremiumLoader';

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    // Only redirect when auth has fully resolved AND there's no user
    if (!loading && !user && !profile) {
      router.replace('/login');
    }
  }, [user, profile, loading, router]);

  // Show loader ONLY during initial auth (no cached profile)
  if (loading && !profile) {
    return <PremiumLoader fullScreen text="" />;
  }

  // Not authenticated and no cached profile
  if (!loading && !user && !profile) {
    return null;
  }

  return <>{children}</>;
}
