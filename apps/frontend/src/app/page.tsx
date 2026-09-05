'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Root redirect — authenticated users go to /dashboard.
 * Unauthenticated state is now handled by the (marketing) route group.
 * 
 * NOTE: In a production setup, this redirect would check auth state
 * and conditionally route to /dashboard or the marketing page.
 */
export default function RootRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);
  return null;
}
