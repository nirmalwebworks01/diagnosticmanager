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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Only redirect when auth has fully resolved AND there's no user
    if (mounted && !loading && !user && !profile) {
      router.replace('/login');
    }
  }, [mounted, user, profile, loading, router]);

  // Before client mounting (SSR and initial client hydration), render loader to guarantee identical HTML
  if (!mounted || (loading && !profile)) {
    return <PremiumLoader fullScreen text="" />;
  }

  // If we have a cached or verified profile, render children
  if (profile) {
    return <>{children}</>;
  }

  // Not authenticated
  return null;
}

