'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * The authenticated workspace begins at /dashboard; this route only forwards.
 */
export default function RootRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);
  return null;
}
