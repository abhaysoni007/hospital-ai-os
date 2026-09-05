'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';
import MedoraLanding from './medora/page';

/**
 * Root Route (/)
 *
 * Behavior:
 * - Unauthenticated visitors: served the MEDORA public marketing landing page.
 * - Authenticated users: redirected directly to /dashboard.
 * - CTA on landing page routes to /login.
 */
export default function RootPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  // Prevent flash during initial session hydration
  if (isLoading) {
    return null;
  }

  // Authenticated users will be redirected to /dashboard
  if (isAuthenticated) {
    return null;
  }

  // Public visitors see the MEDORA landing page
  return <MedoraLanding />;
}
