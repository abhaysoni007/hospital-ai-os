'use client';

import { useState } from 'react';
import '../../styles/medora-landing.css';

// Section components
import MedoraNavbar from '../../components/navigation/MedoraNavbar';
import HeroSection from '../../components/sections/Hero';
import ProofStrip from '../../components/sections/ProofStrip';
import IntroductionSection from '../../components/sections/Introduction';
import FeaturesSection from '../../components/sections/Features';
import WorkflowSection from '../../components/sections/Workflow';
import HumanAISection from '../../components/sections/HumanAI';
import SecuritySection from '../../components/sections/Security';
import MetricsSection from '../../components/sections/Metrics';
import FinalCTA from '../../components/sections/FinalCTA';
import Footer from '../../components/sections/Footer';
import RequestDemoModal from '../../components/modals/RequestDemoModal';

export default function MedoraLanding() {
  const [isDemoOpen, setIsDemoOpen] = useState(false);

  return (
    <div
      data-marketing="true"
      className="medora-root"
      style={{
        backgroundColor: '#EFECE6',
        color: '#111827',
        minHeight: '100vh',
      }}
    >
      {/* Fixed Navigation */}
      <MedoraNavbar onOpenDemo={() => setIsDemoOpen(true)} />

      {/* Main Landing Flow */}
      <main id="main-content">
        {/* 01 — Hero with Realistic EMR Mockup & CTAs */}
        <HeroSection onOpenDemo={() => setIsDemoOpen(true)} />

        {/* 02 — Key Proof & Compliance Strip */}
        <ProofStrip />

        {/* 03 — The Fragmentation Problem & Connected Platform Architecture */}
        <IntroductionSection />

        {/* 04 — Intelligent Workflow Modules: 5-Card Bento Grid */}
        <FeaturesSection />

        {/* 05 — The Care Continuum: 6-Step Workflow */}
        <WorkflowSection />

        {/* 06 — Human + AI Philosophy: High-Contrast Clinical Governance */}
        <HumanAISection />

        {/* 07 — Security by Architecture & Data Pipeline */}
        <SecuritySection />

        {/* 08 — Operational Command Center & Attention Queue */}
        <MetricsSection />

        {/* 09 — Radiant Royal Blue Closing CTA */}
        <FinalCTA onOpenDemo={() => setIsDemoOpen(true)} />
      </main>

      {/* 10 — Footer with Links & Regulatory Medical Disclaimer */}
      <Footer />

      {/* Interactive Request a Demo Modal */}
      <RequestDemoModal isOpen={isDemoOpen} onClose={() => setIsDemoOpen(false)} />
    </div>
  );
}
