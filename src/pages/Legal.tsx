import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo } from '../components/ui/Logo';
import { Button } from '../components/ui/Button';
import { Container } from '../components/ui/Container';
import { copy } from '../content/copy';

export const Legal: React.FC = () => {
  const location = useLocation();
  const isTerms = location.pathname.includes('terms');

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col">
      {/* Top Header */}
      <header className="w-full border-b border-border bg-surface sticky top-0 z-30">
        <Container className="h-16 flex items-center justify-between">
          <Logo tone="light" size="md" />

          <div className="flex items-center gap-3">
            <Link
              to="/terms"
              className={`text-[14px] font-medium px-3 py-1.5 rounded-lg transition-colors ${
                isTerms
                  ? 'bg-surface-2 text-ink font-semibold'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Terms of Service
            </Link>
            <Link
              to="/privacy"
              className={`text-[14px] font-medium px-3 py-1.5 rounded-lg transition-colors ${
                !isTerms
                  ? 'bg-surface-2 text-ink font-semibold'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Privacy Policy
            </Link>
          </div>
        </Container>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-12 sm:py-16">
        <Container className="max-w-[760px]">
          <div className="bg-surface border border-border rounded-[16px] p-6 sm:p-10 shadow-xs">
            <div className="flex items-center gap-2 text-[13px] font-mono text-muted mb-2">
              <span>Updated October 2026</span>
              <span>•</span>
              <span>iveo Legal</span>
            </div>

            <h1 className="text-[32px] font-semibold text-ink leading-tight tracking-tight">
              {isTerms ? 'Terms of Service' : 'Privacy Policy'}
            </h1>

            <p className="mt-3 text-[16px] text-muted leading-relaxed">
              {isTerms
                ? 'These terms govern your access to and use of iveo websites, APIs, and creator tools. By using iveo, you agree to these principles.'
                : 'Your privacy is paramount. This policy explains what data iveo collects, how we use it to provide your page, and your rights.'}
            </p>

            <hr className="my-8 border-border" />

            {isTerms ? (
              // Terms of Service Content
              <div className="space-y-8 text-[15px] leading-relaxed text-ink-2">
                <section>
                  <h2 className="text-[19px] font-semibold text-ink mb-2">
                    1. Account & Your Address
                  </h2>
                  <p>
                    When you claim a username (e.g., iveo.site/yourname), you represent that you have the right to use that identifier. Usernames that infringe on trademarks, impersonate public figures or organizations, or remain dormant for extended periods may be reclaimed or reassigned.
                  </p>
                </section>

                <section>
                  <h2 className="text-[19px] font-semibold text-ink mb-2">
                    2. Content & Ownership
                  </h2>
                  <p>
                    You retain 100% full ownership and intellectual property rights to all links, text, images, and content you post on iveo. We do not sell your content or claim license beyond what is strictly necessary to host and render your page to visitors worldwide.
                  </p>
                </section>

                <section>
                  <h2 className="text-[19px] font-semibold text-ink mb-2">
                    3. Subscriptions & Billing
                  </h2>
                  <p>
                    iveo offers both free accounts and Pro memberships. Paid subscriptions are processed securely via our payment partner (Razorpay) with 256-bit encryption. Pro subscriptions can be cancelled at any time; cancellation takes effect at the end of the current billing cycle.
                  </p>
                </section>

                <section>
                  <h2 className="text-[19px] font-semibold text-ink mb-2">
                    4. Acceptable Use
                  </h2>
                  <p>
                    You agree not to use iveo for malicious activities, phishing, distributing malware, deceptive promotions, or harassment. We reserve the right to suspend or remove pages that violate our community integrity standards.
                  </p>
                </section>

                <section>
                  <h2 className="text-[19px] font-semibold text-ink mb-2">
                    5. Termination & Data Portability
                  </h2>
                  <p>
                    You can export all your data (links, block configurations, statistics, and contacts) or permanently delete your account at any time from your Account Settings. Upon deletion, your page and records are promptly purged.
                  </p>
                </section>
              </div>
            ) : (
              // Privacy Policy Content
              <div className="space-y-8 text-[15px] leading-relaxed text-ink-2">
                <section>
                  <h2 className="text-[19px] font-semibold text-ink mb-2">
                    1. Minimal Data Collection
                  </h2>
                  <p>
                    We collect only the information required to authenticate you and deliver your page: your email address, username, chosen profile image, and the links you choose to publish.
                  </p>
                </section>

                <section>
                  <h2 className="text-[19px] font-semibold text-ink mb-2">
                    2. Privacy-Respecting Analytics
                  </h2>
                  <p>
                    iveo analytics aggregate page views and link clicks without using intrusive tracking cookies or cross-site tracking beacons. We do not sell visitor behavioral profiles or personal data to third-party ad networks.
                  </p>
                </section>

                <section>
                  <h2 className="text-[19px] font-semibold text-ink mb-2">
                    3. Data Security & Storage
                  </h2>
                  <p>
                    All traffic to and from iveo is encrypted in transit using industry-standard TLS. Sensitive credentials are managed through enterprise authentication providers, and payment records are tokenized by PCI-DSS compliant processors.
                  </p>
                </section>

                <section>
                  <h2 className="text-[19px] font-semibold text-ink mb-2">
                    4. Your Rights & GDPR Compliance
                  </h2>
                  <p>
                    You have the right to access, export, rectify, or erase your personal data at any time. You can download an entire JSON/CSV export of your account data directly from the Settings tab.
                  </p>
                </section>
              </div>
            )}

            <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-[13px] text-muted">
                Questions about our policies? Contact{' '}
                <a
                  href={`mailto:${copy.brand.supportEmail}`}
                  className="text-ink font-medium underline underline-offset-2"
                >
                  {copy.brand.supportEmail}
                </a>
              </span>

              <Button as={Link} to="/" variant="secondary" size="md">
                Back to home
              </Button>
            </div>
          </div>
        </Container>
      </main>
    </div>
  );
};

export default Legal;
