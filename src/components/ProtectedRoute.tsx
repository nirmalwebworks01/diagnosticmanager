// src/components/ProtectedRoute.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
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

  // If we have a cached profile, render children IMMEDIATELY - no loader at all
  if (profile) {
    return <>{children}</>;
  }

  // Still loading and no cached profile - show loader
  if (loading) {
    return <PremiumLoader fullScreen text="" />;
  }

  // Not authenticated
  return null;
}
