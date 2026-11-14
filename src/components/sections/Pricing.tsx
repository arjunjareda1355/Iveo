import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Minus } from 'lucide-react';
import { Container } from '../ui/Container';
import { SectionHeader } from '../ui/SectionHeader';
import { Button } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';
import { VerifiedTick } from '../ui/VerifiedTick';
import { PRICING_PLANS } from '../../content/pricing';
import { PLAN_COMPARISON_SECTIONS } from '../../lib/plan';
import { copy } from '../../content/copy';
import { useReveal } from '../../hooks/useReveal';
import { useIvioSession } from '../../auth/useIvioSession';
import { useUpgradeDialog } from '../plan/UpgradeDialogProvider';
import { cn } from '../../lib/cn';

type BillingCycle = 'Monthly' | 'Yearly';

export const Pricing: React.FC = () => {
  const { isSignedIn } = useIvioSession();
  const { openUpgrade } = useUpgradeDialog();
  const [billing, setBilling] = useState<BillingCycle>('Yearly');
  const { ref: headerRef, style: headerStyle } = useReveal();
  const { ref: cardsRef, style: cardsStyle } = useReveal({ staggerIndex: 1 });

  const freePlan = PRICING_PLANS[0];
  const proPlan = PRICING_PLANS[1];

  const isYearly = billing === 'Yearly';

  return (
    <section
      id="pricing"
      aria-label="Pricing"
      className="w-full bg-bg py-14 sm:py-20 lg:py-24 border-b border-border"
    >
      <Container>
        {/* Section Header */}
        <div ref={headerRef} style={headerStyle}>
          <SectionHeader
            eyebrow={copy.pricing.eyebrow}
            heading={copy.pricing.heading}
            lead={copy.pricing.lead}
          />

          {/* Billing Cycle Toggle */}
          <div className="mt-8 flex items-center gap-3">
            <div className="w-[180px]">
              <SegmentedControl
                options={[copy.pricing.billing.monthly, copy.pricing.billing.yearly]}
                value={billing}
                onChange={(val) => setBilling(val as BillingCycle)}
                ariaLabel="Billing frequency"
              />
            </div>
            {isYearly && (
              <span className="text-[13px] text-muted font-medium select-none animate-fadeIn">
                {copy.pricing.billing.twoMonthsFree}
              </span>
            )}
          </div>
        </div>

        {/* Plan Cards Row */}
        <div
          ref={cardsRef}
          style={cardsStyle}
          className="mt-8 sm:mt-10 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[880px]"
        >
          {/* Free Plan Card */}
          <div className="rounded-[14px] bg-surface p-6 sm:p-7 border border-border shadow-[0_1px_2px_rgba(10,10,10,0.04)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-[20px] font-semibold text-ink leading-tight">
                  {freePlan.name}
                </h3>
              </div>

              {/* Price */}
              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="text-[48px] font-medium leading-none text-ink tabular-nums tracking-tight">
                  {freePlan.monthlyPrice}
                </span>
                <span className="text-[14px] text-muted">
                  {freePlan.monthlyPeriod}
                </span>
              </div>

              {/* Description */}
              <p className="mt-4 text-[15px] leading-relaxed text-muted">
                {freePlan.description}
              </p>

              {/* Button */}
              <div className="mt-6">
                <Button
                  as={Link}
                  to={isSignedIn ? '/dashboard' : freePlan.buttonHref}
                  variant="secondary"
                  size="lg"
                  fullWidth
                >
                  {isSignedIn ? 'Go to dashboard' : freePlan.buttonLabel}
                </Button>
              </div>

              {/* Divider */}
              <div className="my-6 h-px w-full bg-border" aria-hidden="true" />

              {/* Features List */}
              <ul className="flex flex-col gap-3">
                {freePlan.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2.5 text-[15px] text-ink-2">
                    <Check size={16} strokeWidth={2} className="text-ink shrink-0" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Pro Plan Card (Inverse Styling) */}
          <div className="rounded-[14px] bg-[#0A0A0A] p-6 sm:p-7 border border-[#262626] text-[#FAFAFA] shadow-[0_24px_48px_-12px_rgba(10,10,10,0.14),0_2px_6px_rgba(10,10,10,0.05)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-[20px] font-semibold text-[#FAFAFA] leading-tight">
                  {proPlan.name}
                </h3>
                {proPlan.badge && (
                  <span className="rounded-full bg-[#FAFAFA] text-[#0A0A0A] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider select-none">
                    {proPlan.badge}
                  </span>
                )}
              </div>

              {/* Price: 200ms crossfade on toggle */}
              <div className="mt-4 flex items-baseline gap-1.5 relative h-12">
                <div
                  className="flex items-baseline gap-1.5 transition-opacity duration-200"
                  key={billing}
                >
                  <span className="text-[48px] font-medium leading-none text-[#FAFAFA] tabular-nums tracking-tight">
                    {isYearly ? proPlan.yearlyPrice : proPlan.monthlyPrice}
                  </span>
                  <span className="text-[14px] text-[#A3A3A3]">
                    {isYearly ? proPlan.yearlyPeriod : proPlan.monthlyPeriod}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="mt-4 text-[15px] leading-relaxed text-[#A3A3A3]">
                {proPlan.description}
              </p>

              {/* Button */}
              <div className="mt-6">
                {isSignedIn ? (
                  <Button
                    variant="inverse"
                    size="lg"
                    fullWidth
                    onClick={() => openUpgrade()}
                  >
                    Upgrade to Pro
                  </Button>
                ) : (
                  <Button
                    as={Link}
                    to={proPlan.buttonHref}
                    variant="inverse"
                    size="lg"
                    fullWidth
                  >
                    {proPlan.buttonLabel}
                  </Button>
                )}
              </div>

              {/* Divider */}
              <div className="my-6 h-px w-full bg-[#262626]" aria-hidden="true" />

              {/* Features List */}
              <ul className="flex flex-col gap-3">
                {proPlan.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2.5 text-[15px] text-[#E5E5E5]">
                    <Check size={16} strokeWidth={2} className="text-[#FAFAFA] shrink-0" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Free vs Pro Comparison Matrix */}
        <div
          id="compare-plans"
          className="mt-12 sm:mt-16 max-w-[880px] rounded-[14px] border border-border bg-surface overflow-hidden shadow-[0_1px_2px_rgba(10,10,10,0.03)]"
        >
          <div className="px-5 py-4 sm:px-6 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-surface-2/60">
            <div>
              <h3 className="text-[17px] font-semibold text-ink tracking-tight">
                Compare Free vs. Pro
              </h3>
              <p className="text-[13px] text-muted mt-0.5">
                Every capability separated clearly between Free creators and Verified Pro members.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink">
              <VerifiedTick size={14} />
              <span>Pro includes Verified Tick</span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-[12px] font-semibold uppercase tracking-wider text-muted bg-surface">
                  <th scope="col" className="py-3 px-5 sm:px-6 w-[52%]">
                    Feature
                  </th>
                  <th scope="col" className="py-3 px-4 w-[24%] text-center">
                    Free
                  </th>
                  <th scope="col" className="py-3 px-4 sm:px-6 w-[24%] text-center text-ink">
                    Pro
                  </th>
                </tr>
              </thead>
              <tbody>
                {PLAN_COMPARISON_SECTIONS.map((section) => (
                  <React.Fragment key={section.category}>
                    <tr className="bg-surface-2/50 border-b border-border">
                      <th
                        colSpan={3}
                        scope="colgroup"
                        className="py-2.5 px-5 sm:px-6 text-[11px] font-semibold uppercase tracking-wider text-muted"
                      >
                        {section.category}
                      </th>
                    </tr>
                    {section.rows.map((row) => {
                      const renderCell = (val: string | boolean, isProCol: boolean) => {
                        if (val === true) {
                          return (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-ink/5 text-ink">
                              <Check size={13} strokeWidth={2.5} aria-label="Included" />
                            </span>
                          );
                        }
                        if (val === false) {
                          return (
                            <span className="inline-flex items-center justify-center text-subtle">
                              <Minus size={14} strokeWidth={2} aria-label="Not included" />
                            </span>
                          );
                        }
                        if (isProCol && row.feature.toLowerCase().includes('verified pro tick')) {
                          return (
                            <span className="inline-flex items-center justify-center gap-1.5 text-[13px] font-medium text-ink">
                              <VerifiedTick size={13} />
                              <span>{val}</span>
                            </span>
                          );
                        }
                        return (
                          <span
                            className={`text-[13px] ${
                              isProCol ? 'font-medium text-ink' : 'text-ink-2'
                            }`}
                          >
                            {val}
                          </span>
                        );
                      };

                      return (
                        <tr
                          key={row.feature}
                          className="border-b border-border/70 last:border-b-0 hover:bg-surface-2/30 transition-colors"
                        >
                          <td className="py-3 px-5 sm:px-6 text-[14px] text-ink">
                            {row.feature}
                          </td>
                          <td className="py-3 px-4 text-center align-middle">
                            {renderCell(row.free, false)}
                          </td>
                          <td className="py-3 px-4 sm:px-6 text-center align-middle">
                            {renderCell(row.pro, true)}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Team inquiry note */}
        <div className="mt-8 text-[14px] text-muted">
          <span>{copy.pricing.teamNotePrefix} </span>
          <a
            href="mailto:help@iveo.site?subject=iveo%20team%20plan"
            className="text-ink underline underline-offset-[3px] hover:text-ink-2 font-medium"
          >
            help@iveo.site
          </a>
        </div>
      </Container>
    </section>
  );
};
