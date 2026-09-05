'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
import '../../styles/medora-landing.css';

// Motion infrastructure
import SmoothScroll from '../../components/motion/SmoothScroll';
import LoadingScreen from '../../components/motion/LoadingScreen';

// Eager-loaded components
import MedoraNavbar from '../../components/navigation/MedoraNavbar';
import HeroSection from '../../components/sections/Hero';
import IntroductionSection from '../../components/sections/Introduction';
import SystemSection from '../../components/sections/System';
import WorkflowSection from '../../components/sections/Workflow';
import SecuritySection from '../../components/sections/Security';
import HumanAISection from '../../components/sections/HumanAI';
import FeaturesSection from '../../components/sections/Features';
import MetricsSection from '../../components/sections/Metrics';
import Footer from '../../components/sections/Footer';

// Dynamic imports for heavy/interactive components
const FinalCTA = dynamic(() => import('../../components/sections/FinalCTA'), { ssr: false });
const CustomCursor = dynamic(() => import('../../components/motion/CustomCursor'), { ssr: false });

export default function MedoraLanding() {
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLoadComplete = useCallback(() => {
    setLoading(false);
  }, []);

  return (
    <div
      data-marketing="true"
      style={{
        background: 'var(--m-bg-void)',
        color: 'var(--m-text-primary)',
        minHeight: '100vh',
      }}
    >
      {/* Branded loading sequence */}
      {loading && mounted && <LoadingScreen onComplete={handleLoadComplete} />}

      {/* Custom cursor — desktop only, SSR-safe */}
      {mounted && <CustomCursor />}

      {!loading && (
        <SmoothScroll>
          {/* Fixed navigation */}
          <MedoraNavbar />

          {/* Main content */}
          <main id="main-content">
            {/* 01 — Hero with 3D core and scroll choreography */}
            <HeroSection />

            {/* 02 — Introduction: masked line reveals */}
            <IntroductionSection />

            {/* 03 — Platform: animated SVG system network */}
            <SystemSection />

            {/* 04 — Intelligence / Core Capabilities: interactive vertical sequence */}
            <FeaturesSection />

            {/* 05 — Workflow: horizontal pinned scroll */}
            <WorkflowSection />

            {/* 06 — Metrics: architectural telemetry scale */}
            <MetricsSection />

            {/* 07 — Security: grid and architectural trust */}
            <SecuritySection />

            {/* 08 — Human + AI: split convergence */}
            <HumanAISection />

            {/* 09 — Final CTA: cinematic closing */}
            <Suspense fallback={null}>
              <FinalCTA />
            </Suspense>
          </main>

          {/* Footer */}
          <Footer />
        </SmoothScroll>
      )}
    </div>
  );
}
