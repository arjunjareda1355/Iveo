import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { SegmentedControl } from '../ui/SegmentedControl';
import { SignupConfig, SignupCollectMode } from '../../data/types';
import { copy } from '../../content/copy';

interface SignupComposerProps {
  initialValues?: Partial<SignupConfig>;
  ownerName?: string;
  onSave: (config: SignupConfig) => Promise<void>;
  onCancel: () => void;
  isEditing?: boolean;
}

export const SignupComposer: React.FC<SignupComposerProps> = ({
  initialValues,
  ownerName,
  onSave,
  onCancel,
  isEditing = false,
}) => {
  const defaultConsentSentence = copy.signup.dashboard.defaultConsent.replace(
    '{name}',
    ownerName || 'me'
  );

  const [heading, setHeading] = useState(
    initialValues?.heading || copy.signup.dashboard.defaultHeading
  );
  const [description, setDescription] = useState(
    initialValues?.description || ''
  );
  const [collect, setCollect] = useState<SignupCollectMode>(
    initialValues?.collect || 'email'
  );
  const [buttonLabel, setButtonLabel] = useState(
    initialValues?.button || copy.signup.dashboard.defaultButton
  );
  const [consent, setConsent] = useState(
    initialValues?.consent || defaultConsentSentence
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    const cleanHeading = heading.trim();
    if (!cleanHeading) {
      errs.heading = copy.signup.dashboard.validation.headingRequired;
    } else if (cleanHeading.length > 60) {
      errs.heading = copy.signup.dashboard.validation.headingMax;
    }

    if (description.trim().length > 120) {
      errs.description = copy.signup.dashboard.validation.descriptionMax;
    }

    const cleanButton = buttonLabel.trim();
    if (!cleanButton) {
      errs.button = copy.signup.dashboard.validation.buttonRequired;
    } else if (cleanButton.length > 20) {
      errs.button = copy.signup.dashboard.validation.buttonMax;
    }

    const cleanConsent = consent.trim();
    if (!cleanConsent) {
      errs.consent = copy.signup.dashboard.validation.consentRequired;
    } else if (cleanConsent.length > 200) {
      errs.consent = copy.signup.dashboard.validation.consentMax;
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSave({
        heading: heading.trim(),
        description: description.trim() || null,
        collect,
        button: buttonLabel.trim(),
        consent: consent.trim(),
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'pro_required') {
        setSubmitError('Upgrade to Pro to add an Audience Signup form.');
      } else {
        setSubmitError(err instanceof Error ? err.message : "Couldn't save signup form. Try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const collectOptions = [
    { value: 'email' as const, label: copy.signup.dashboard.collectOptions.email },
    { value: 'phone' as const, label: copy.signup.dashboard.collectOptions.phone },
    { value: 'both' as const, label: copy.signup.dashboard.collectOptions.both },
  ];

  return (
    <Card className="p-4 sm:p-5 border-border shadow-sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h3 className="text-[16px] font-semibold text-ink">
          {isEditing ? 'Edit signup form' : copy.signup.dashboard.addButton}
        </h3>

        {/* Heading */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label
              htmlFor="signup-heading"
              className="text-[13px] font-medium text-ink"
            >
              {copy.signup.dashboard.headingLabel}
            </label>
            <span className="text-[11px] text-muted">{heading.length}/60</span>
          </div>
          <input
            id="signup-heading"
            type="text"
            maxLength={60}
            value={heading}
            onChange={(e) => {
              setHeading(e.target.value);
              if (errors.heading) setErrors((prev) => ({ ...prev, heading: '' }));
            }}
            placeholder={copy.signup.dashboard.defaultHeading}
            className="w-full h-9 px-3 text-[14px] bg-surface border border-border rounded-[8px] text-ink focus:outline-none focus:ring-1 focus:ring-ink"
          />
          {errors.heading && (
            <p className="mt-1 text-[12px] text-red-600 font-medium">
              {errors.heading}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label
              htmlFor="signup-desc"
              className="text-[13px] font-medium text-ink"
            >
              {copy.signup.dashboard.descriptionLabel}
            </label>
            <span className="text-[11px] text-muted">
              {description.length}/120
            </span>
          </div>
          <textarea
            id="signup-desc"
            rows={2}
            maxLength={120}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (errors.description)
                setErrors((prev) => ({ ...prev, description: '' }));
            }}
            placeholder={copy.signup.dashboard.descriptionPlaceholder}
            className="w-full px-3 py-2 text-[14px] bg-surface border border-border rounded-[8px] text-ink focus:outline-none focus:ring-1 focus:ring-ink resize-none"
          />
          {errors.description && (
            <p className="mt-1 text-[12px] text-red-600 font-medium">
              {errors.description}
            </p>
          )}
        </div>

        {/* Collect mode */}
        <div>
          <label className="block text-[13px] font-medium text-ink mb-1.5">
            {copy.signup.dashboard.collectLabel}
          </label>
          <SegmentedControl
            options={collectOptions}
            value={collect}
            onChange={(val) => setCollect(val)}
            className="w-full"
          />
        </div>

        {/* Button label */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label
              htmlFor="signup-button"
              className="text-[13px] font-medium text-ink"
            >
              {copy.signup.dashboard.buttonLabel}
            </label>
            <span className="text-[11px] text-muted">
              {buttonLabel.length}/20
            </span>
          </div>
          <input
            id="signup-button"
            type="text"
            maxLength={20}
            value={buttonLabel}
            onChange={(e) => {
              setButtonLabel(e.target.value);
              if (errors.button) setErrors((prev) => ({ ...prev, button: '' }));
            }}
            placeholder={copy.signup.dashboard.defaultButton}
            className="w-full h-9 px-3 text-[14px] bg-surface border border-border rounded-[8px] text-ink focus:outline-none focus:ring-1 focus:ring-ink"
          />
          {errors.button && (
            <p className="mt-1 text-[12px] text-red-600 font-medium">
              {errors.button}
            </p>
          )}
        </div>

        {/* Consent sentence */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label
              htmlFor="signup-consent"
              className="text-[13px] font-medium text-ink"
            >
              {copy.signup.dashboard.consentLabel}
            </label>
            <span className="text-[11px] text-muted">{consent.length}/200</span>
          </div>
          <textarea
            id="signup-consent"
            rows={2}
            maxLength={200}
            value={consent}
            onChange={(e) => {
              setConsent(e.target.value);
              if (errors.consent)
                setErrors((prev) => ({ ...prev, consent: '' }));
            }}
            className="w-full px-3 py-2 text-[14px] bg-surface border border-border rounded-[8px] text-ink focus:outline-none focus:ring-1 focus:ring-ink resize-none"
          />
          <p className="mt-1 text-[12px] text-muted">
            {copy.signup.dashboard.consentHelper}
          </p>
          {errors.consent && (
            <p className="mt-1 text-[12px] text-red-600 font-medium">
              {errors.consent}
            </p>
          )}
        </div>

        {/* Responsibility Notice */}
        <p className="text-[12px] text-muted">
          {copy.signup.dashboard.responsibilityNotice}
        </p>

        {submitError && (
          <p className="text-[13px] text-red-600 font-medium" role="alert">
            {submitError}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {copy.signup.dashboard.cancelButton}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'Saving...'
              : isEditing
              ? 'Save changes'
              : copy.signup.dashboard.addButton}
          </Button>
        </div>
      </form>
    </Card>
  );
};
