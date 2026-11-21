import { SITE_LOGO_SRC } from '../components/ui/Logo';

export const IVEO_LOGO_DATA_URI = SITE_LOGO_SRC;
export const IVIO_LOGO_DATA_URI = SITE_LOGO_SRC;

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
    colorSuccess: '#166534',
    colorWarning: '#92400E',
    colorRing: '#0A0A0A',
    colorShadow: '#0A0A0A',
    borderRadius: '0.75rem',
    fontFamily: 'inherit',
    fontFamilyButtons: 'inherit',
    fontSize: '0.9375rem',
  },
  options: {
    logoImageUrl: SITE_LOGO_SRC,
    logoPlacement: 'inside' as const,
    logoLinkUrl: '/',
    socialButtonsPlacement: 'top' as const,
    socialButtonsVariant: 'iconButton' as const,
    termsPageUrl: '/terms',
    privacyPageUrl: '/privacy',
    helpPageUrl: 'mailto:help@iveo.site',
    showOptionalFields: false,
  },
  elements: {
    logoBox: {
      height: '44px',
      maxHeight: '44px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '4px',
    },
    logoImage: {
      height: '44px',
      width: '44px',
      maxHeight: '44px',
      maxWidth: '44px',
      objectFit: 'contain',
      borderRadius: '10px',
    },
    card: {
      border: '1px solid #E5E5E5',
      boxShadow: 'none',
      borderRadius: '16px',
    },
    modalContent: {
      borderRadius: '16px',
      border: '1px solid #E5E5E5',
    },
    headerTitle: {
      fontWeight: 600,
      letterSpacing: '-0.02em',
      fontSize: '1.25rem',
    },
    formButtonPrimary: {
      textTransform: 'none',
      fontWeight: 500,
      minHeight: '44px',
      borderRadius: '12px',
      boxShadow: 'none',
    },
    formButtonReset: {
      textTransform: 'none',
      fontWeight: 500,
      minHeight: '44px',
      borderRadius: '12px',
    },
    socialButtonsBlockButton: {
      borderColor: '#D4D4D4',
      minHeight: '44px',
      borderRadius: '12px',
    },
    socialButtonsIconButton: {
      borderColor: '#D4D4D4',
      minHeight: '44px',
      borderRadius: '12px',
    },
    footerActionLink: {
      color: '#0A0A0A',
      textDecoration: 'underline',
      textUnderlineOffset: '3px',
    },
    formFieldInput: {
      minHeight: '44px',
      borderRadius: '12px',
      borderColor: '#E5E5E5',
      backgroundColor: '#FFFFFF',
    },
    badge: {
      borderRadius: '9999px',
      fontSize: '0.75rem',
      fontWeight: 500,
    },
  },
};

// Backward-compatible alias
export const ivioAppearance = iveoAppearance;
