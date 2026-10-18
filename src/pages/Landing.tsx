import React from 'react';
import { Navbar } from '../components/sections/Navbar';
import { Hero } from '../components/sections/Hero';
import { MadeFor } from '../components/sections/MadeFor';
import { HowItWorks } from '../components/sections/HowItWorks';
import { VibesShowcase } from '../components/sections/VibesShowcase';
import { Features } from '../components/sections/Features';
import { Principles } from '../components/sections/Principles';
import { Pricing } from '../components/sections/Pricing';
import { Faq } from '../components/sections/Faq';
import { FinalCta } from '../components/sections/FinalCta';
import { Footer } from '../components/sections/Footer';

export const Landing: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-bg text-ink selection:bg-ink selection:text-white">
      {/* Skip to content link */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-ink focus:text-white focus:px-4 focus:py-3 focus:rounded-[10px] focus:outline-2 focus:outline-white font-medium text-[14px]"
      >
        Skip to content
      </a>

      {/* Navbar */}
      <Navbar />

      {/* Main Landmark */}
      <main id="main" className="flex-1">
        <Hero />
        <MadeFor />
        <HowItWorks />
        <VibesShowcase />
        <Features />
        <Principles />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Landing;
