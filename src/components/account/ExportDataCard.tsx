import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { useAuth } from '@clerk/react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { useIveoSession } from '../../auth/useIvioSession';
import { listMyBlocks } from '../../data/linksApi';
import { getProtectedLinkIds } from '../../data/passwordApi';
import { fetchPublicPage } from '../../data/publicPageApi';
import { copy } from '../../content/copy';

export const ExportDataCard: React.FC = () => {
  const session = useIveoSession();
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!session.username || isExporting) return;
    setIsExporting(true);

    try {
      let token: string | null = null;
      try {
        token = await getToken({ template: 'supabase' }).catch(() => null);
      } catch {
        // Token error
      }

      // 1. Fetch fresh blocks (all kinds, active, archived, scheduled)
      const blocks = await listMyBlocks(token, session.username);
      const protectedIds = await getProtectedLinkIds(token).catch(() => []);
      const protectedSet = new Set(protectedIds);

      // 2. Fetch fresh public profile to get socials, is_published, hide_from_search
      const publicData = await fetchPublicPage(session.username).catch(() => null);

      const profileSocials = publicData?.profile?.socials || {};
      const socialsList = Object.entries(profileSocials).map(([platform, url]) => ({
        platform,
        url: String(url),
      }));

      // 3. Assemble JSON export structure according to Section 11 contract
      const exportObject = {
        exportedAt: new Date().toISOString(),
        version: 1,
        profile: {
          username: session.username,
          displayName: session.displayName || session.username,
          bio: publicData?.profile?.bio || '',
          vibe: session.vibeId,
          buttonShape: session.buttonShape || 'rounded',
          socials: socialsList,
          isPublished: true,
          hideFromSearch: publicData?.profile?.hideFromSearch || false,
          hideIveoFooter: session.hideIveoFooter || false,
        },
        links: blocks.map((b) => ({
          kind: b.kind,
          title: b.title,
          url: b.url,
          icon: b.icon,
          layout: b.layout,
          embedProvider: b.embedProvider,
          thumbnailUrl: b.thumbnailUrl,
          startAt: b.startAt,
          endAt: b.endAt,
          isActive: b.isActive,
          isArchived: b.isArchived,
          position: b.position,
          signup: b.signup,
          isProtected: b.kind === 'link' ? (protectedSet.has(b.id) || b.isProtected === true) : undefined,
        })),
      };

      // 4. Create and trigger download
      const jsonString = JSON.stringify(exportObject, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const objectUrl = URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `iveo-data-${session.username}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 100);

      showToast(copy.exportData.successToast);
    } catch {
      showToast(copy.exportData.errorToast);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card className="flex flex-col items-start gap-4 p-5 sm:p-6">
      <h3 className="text-[17px] sm:text-[18px] font-semibold text-ink">
        {copy.exportData.cardTitle}
      </h3>

      <p className="text-[14px] text-muted leading-relaxed">
        {copy.exportData.cardBody}
      </p>

      <Button
        variant="secondary"
        size="md"
        onClick={handleExport}
        disabled={isExporting}
        className="flex items-center gap-2"
      >
        <Download size={16} strokeWidth={1.5} />
        <span>
          {isExporting ? 'Exporting...' : copy.exportData.exportButton}
        </span>
      </Button>
    </Card>
  );
};
