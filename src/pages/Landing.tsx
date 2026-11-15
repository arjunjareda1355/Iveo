import React, { useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
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
import { useToast } from '../components/ui/Toast';
import { usePageMeta } from '../hooks/usePageMeta';
import { SITE_ORIGIN } from '../lib/site';
import { copy } from '../content/copy';

export const Landing: React.FC = () => {
  const { pathname } = useLocation();
  const isPricingRoute = pathname === '/pricing';

  usePageMeta({
    title: isPricingRoute
      ? 'Pricing – Free & Pro Plans | Iveo'
      : 'Iveo – One Link for Everything You Create',
    description: isPricingRoute
      ? 'Start free with unlimited links and custom vibes, or upgrade to Iveo Pro for custom fonts, advanced analytics, business cards, and SEO tools.'
      : 'Create your personal space with Iveo. Share your social links, websites, projects and everything you create through one beautiful, customizable profile.',
    canonical: `${SITE_ORIGIN}${isPricingRoute ? '/pricing' : '/'}`,
    robots: 'index, follow',
  });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    if (searchParams.get('deleted') === '1') {
      showToast(copy.deleteAccount.deletedToast);
      navigate('/', { replace: true });
    }
  }, [searchParams, navigate, showToast]);

  useEffect(() => {
    if (!isPricingRoute) return;
    const timer = window.setTimeout(() => {
      document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [isPricingRoute]);
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
