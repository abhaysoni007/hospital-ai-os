'use client';

import { useEffect, useRef } from 'react';
import Lenis from '@studio-freight/lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * SmoothScroll — Global Lenis instance wired to GSAP ticker.
 * Must wrap the entire marketing page content.
 * Uses a single global instance with proper cleanup.
 */
export default function SmoothScroll({
  children,
}: {
  children: React.ReactNode;
}) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
      touchMultiplier: 2,
      infinite: false,
    });

    lenisRef.current = lenis;

    // Wire Lenis to GSAP ticker — critical for ScrollTrigger sync
    function onRafTick(time: number) {
      lenis.raf(time * 1000);
    }

    gsap.ticker.add(onRafTick);
    gsap.ticker.lagSmoothing(0);

    // Connect Lenis scroll position to ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);

    // Refresh ScrollTrigger when all content has loaded
    ScrollTrigger.refresh();

    return () => {
      gsap.ticker.remove(onRafTick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return <>{children}</>;
}
