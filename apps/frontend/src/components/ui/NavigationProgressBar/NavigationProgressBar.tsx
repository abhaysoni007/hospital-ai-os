'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import styles from './NavigationProgressBar.module.css';

/**
 * M18 Part 2.1 — Immediate Navigation Feedback Indicator
 *
 * Provides immediate visible feedback when an internal navigation occurs.
 * - Detects internal link clicks globally.
 * - Listens for custom 'app:navigation-start' events (for programmatic transitions).
 * - Clears automatically on pathname/searchParams change or safety timeout.
 * - Respects prefers-reduced-motion.
 */

export function notifyNavigationStart(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:navigation-start'));
  }
}

export function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  // Clear navigation state when route changes
  useEffect(() => {
    if (isNavigating) {
      setIsFinished(true);
      const finishTimer = setTimeout(() => {
        setIsNavigating(false);
        setIsFinished(false);
      }, 150);
      return () => clearTimeout(finishTimer);
    }
  }, [pathname, searchParams]);

  // Safety timeout: never let indicator stay stuck indefinitely if navigation is cancelled
  useEffect(() => {
    if (!isNavigating) return;
    const safetyTimer = setTimeout(() => {
      setIsNavigating(false);
      setIsFinished(false);
    }, 8000);
    return () => clearTimeout(safetyTimer);
  }, [isNavigating]);

  // Global click interception for internal links
  useEffect(() => {
    const handleNavigationStartEvent = () => {
      setIsNavigating(true);
      setIsFinished(false);
    };

    const handleClick = (e: MouseEvent) => {
      // Don't intercept modified clicks (Cmd/Ctrl/Shift/Alt)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.defaultPrevented) return;

      const target = (e.target as HTMLElement)?.closest?.('a');
      if (!target || !target.href) return;
      if (target.target === '_blank') return;
      if (target.hasAttribute('download')) return;

      const currentOrigin = window.location.origin;
      if (target.href.startsWith(currentOrigin)) {
        const targetPath = target.href.slice(currentOrigin.length);
        const currentPath = window.location.pathname + window.location.search;
        if (targetPath && targetPath !== currentPath && !targetPath.startsWith('/#')) {
          setIsNavigating(true);
          setIsFinished(false);
        }
      }
    };

    window.addEventListener('click', handleClick, { capture: true });
    window.addEventListener('app:navigation-start', handleNavigationStartEvent);

    return () => {
      window.removeEventListener('click', handleClick, { capture: true });
      window.removeEventListener('app:navigation-start', handleNavigationStartEvent);
    };
  }, []);

  if (!isNavigating && !isFinished) return null;

  return (
    <div
      className={`${styles.progressContainer} ${isNavigating || isFinished ? styles.visible : ''}`}
      role="progressbar"
      aria-label="Loading page"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={isFinished ? 100 : 70}
    >
      <div
        className={`${styles.progressBar} ${
          isFinished ? styles.finished : isNavigating ? styles.animating : ''
        }`}
      />
    </div>
  );
}
