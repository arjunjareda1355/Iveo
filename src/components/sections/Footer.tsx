import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Instagram, Youtube } from 'lucide-react';
import { Container } from '../ui/Container';
import { Logo } from '../ui/Logo';
import { copy } from '../../content/copy';
import { useIvioSession } from '../../auth/useIvioSession';

export const Footer: React.FC = () => {
  const { isSignedIn } = useIvioSession();
  return (
    <footer
      aria-label="Site Footer"
      className="w-full bg-bg border-t border-border pt-16 pb-10"
    >
      <Container>
        {/* Desktop 4-column layout & Mobile responsive grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8">
          {/* Brand Column (spans 5 on desktop) */}
          <div className="md:col-span-5 flex flex-col items-start">
            <Logo tone="light" size="md" />
            <p className="mt-3 text-[15px] leading-relaxed text-muted max-w-[28ch]">
              {copy.brand.tagline}
            </p>
            <a
              href={`mailto:${copy.brand.supportEmail}`}
              className="mt-5 inline-flex items-center gap-2 text-[15px] text-ink hover:text-ink-2 font-medium underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-ink"
            >
              <Mail size={16} strokeWidth={1.5} className="text-subtle shrink-0" />
              <span>{copy.brand.supportEmail}</span>
            </a>

            {/* Iveo Social Media Accounts CTA */}
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <a
                href="https://youtube.com/@iveosite"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="iveo on YouTube"
                title="iveo on YouTube (@iveosite)"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-surface-2 hover:bg-surface border border-border text-[13px] font-medium text-ink transition-all hover:scale-105"
              >
                <Youtube size={16} strokeWidth={1.75} className="text-[#FF0000]" />
                <span>YouTube</span>
              </a>
              <a
                href="https://www.instagram.com/iveo.site"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="iveo on Instagram"
                title="iveo on Instagram (@iveo.site)"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-surface-2 hover:bg-surface border border-border text-[13px] font-medium text-ink transition-all hover:scale-105"
              >
                <Instagram size={16} strokeWidth={1.75} className="text-[#E4405F]" />
                <span>Instagram</span>
              </a>
              <a
                href="https://x.com/@iveosite"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="iveo on X"
                title="iveo on X (@iveosite)"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-surface-2 hover:bg-surface border border-border text-[13px] font-medium text-ink transition-all hover:scale-105"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span>X</span>
              </a>
            </div>
          </div>

          {/* Product Column (spans 2) */}
          <div className="md:col-span-2 flex flex-col items-start">
            <span className="font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-muted mb-4 select-none">
              {copy.footer.columns.product}
            </span>
            <ul className="flex flex-col gap-3 text-[14px]">
              <li>
                <a
                  href="#how"
                  className="text-ink-2 hover:text-ink hover:underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-ink"
                >
                  How it works
                </a>
              </li>
              <li>
                <a
                  href="#vibes"
                  className="text-ink-2 hover:text-ink hover:underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-ink"
                >
                  Vibes
                </a>
              </li>
              <li>
                <a
                  href="#features"
                  className="text-ink-2 hover:text-ink hover:underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-ink"
                >
                  Features
                </a>
              </li>
              <li>
                <Link
                  to="/discover"
                  className="text-ink-2 hover:text-ink hover:underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-ink"
                >
                  Discover creators
                </Link>
              </li>
              <li>
                <a
                  href="#pricing"
                  className="text-ink-2 hover:text-ink hover:underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-ink"
                >
                  Pricing
                </a>
              </li>
            </ul>
          </div>

          {/* Support Column (spans 2) */}
          <div className="md:col-span-2 flex flex-col items-start">
            <span className="font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-muted mb-4 select-none">
              {copy.footer.columns.support}
            </span>
            <ul className="flex flex-col gap-3 text-[14px]">
              <li>
                <a
                  href="#faq"
                  className="text-ink-2 hover:text-ink hover:underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-ink"
                >
                  FAQ
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${copy.brand.supportEmail}`}
                  className="text-ink-2 hover:text-ink hover:underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-ink"
                >
                  Email us
                </a>
              </li>
              {isSignedIn ? (
                <>
                  <li>
                    <Link
                      to="/dashboard"
                      className="text-ink-2 hover:text-ink hover:underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-ink"
                    >
                      Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/account"
                      className="text-ink-2 hover:text-ink hover:underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-ink"
                    >
                      Account
                    </Link>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link
                      to="/login"
                      className="text-ink-2 hover:text-ink hover:underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-ink"
                    >
                      Log in
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/signup"
                      className="text-ink-2 hover:text-ink hover:underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-ink"
                    >
                      Sign up
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* Legal Column (spans 3, right-aligned) */}
          <div className="md:col-span-3 flex flex-col items-start md:items-end">
            <div className="flex flex-col items-start">
              <span className="font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-muted mb-4 select-none">
                {copy.footer.columns.legal}
              </span>
              <ul className="flex flex-col gap-3 text-[14px]">
                <li>
                  <Link
                    to="/privacy"
                    className="text-ink-2 hover:text-ink hover:underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-ink"
                  >
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link
                    to="/terms"
                    className="text-ink-2 hover:text-ink hover:underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-ink"
                  >
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-14 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-[13px] text-muted">
            {copy.brand.copyright}
          </span>
          <span className="hidden md:inline font-mono text-[13px] text-muted select-none">
            {copy.brand.domain}
          </span>
        </div>
      </Container>
    </footer>
  );
};
