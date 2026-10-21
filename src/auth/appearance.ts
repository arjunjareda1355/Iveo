// Static data URI of the iveo mark SVG
export const IVEO_LOGO_DATA_URI =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Crect width="24" height="24" rx="7" fill="%230A0A0A"/%3E%3Ccircle cx="12" cy="7.25" r="1.75" fill="%23FFFFFF"/%3E%3Crect x="10.5" y="10.5" width="3" height="8" rx="1.5" fill="%23FFFFFF"/%3E%3C/svg%3E';

// Backward-compatible alias
export const IVIO_LOGO_DATA_URI = IVEO_LOGO_DATA_URI;

export const iveoAppearance = {
  variables: {
    colorPrimary: '#0A0A0A',
    colorPrimaryForeground: '#FFFFFF',
    colorBackground: '#FFFFFF',
    colorForeground: '#0A0A0A',
    colorMuted: '#F5F5F5',
    colorMutedForeground: '#666666',
    colorInput: '#FFFFFF',
    colorInputForeground: '#0A0A0A',
    colorBorder: '#E5E5E5',
    colorNeutral: '#0A0A0A',
    colorDanger: '#B3261E',
    colorSuccess: '#0A0A0A',
    colorWarning: '#666666',
    colorRing: '#0A0A0A',
    colorShadow: '#0A0A0A',
    borderRadius: '0.625rem',
    fontFamily: 'inherit',
    fontFamilyButtons: 'inherit',
    fontSize: '0.9375rem',
  },
  layout: {
    logoImageUrl: IVEO_LOGO_DATA_URI,
    logoPlacement: 'inside' as const,
    logoLinkUrl: '/',
    socialButtonsPlacement: 'top' as const,
    socialButtonsVariant: 'blockButton' as const,
    termsPageUrl: '/terms',
    privacyPageUrl: '/privacy',
    helpPageUrl: 'mailto:help@iveo.site',
    showOptionalFields: false,
  },
  elements: {
    card: {
      border: '1px solid #E5E5E5',
      boxShadow: '0 1px 2px rgba(10, 10, 10, 0.04)',
      borderRadius: '14px',
    },
    headerTitle: {
      fontWeight: 500,
      letterSpacing: '-0.02em',
    },
    formButtonPrimary: {
      textTransform: 'none',
      fontWeight: 500,
      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.12)',
    },
    socialButtonsBlockButton: {
      borderColor: '#D4D4D4',
    },
    footerActionLink: {
      color: '#0A0A0A',
      textDecoration: 'underline',
      textUnderlineOffset: '3px',
    },
    formFieldInput: {
      minHeight: '44px',
    },
  },
};

// Backward-compatible alias
export const ivioAppearance = iveoAppearance;
