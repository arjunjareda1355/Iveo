import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, ArrowUpRight, Sparkles, Compass } from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { Button } from '../components/ui/Button';
import { Container } from '../components/ui/Container';
import { Footer } from '../components/sections/Footer';
import { VerifiedTick } from '../components/ui/VerifiedTick';
import { usePageMeta } from '../hooks/usePageMeta';
import { SITE_ORIGIN } from '../lib/site';
import { VIBES } from '../lib/vibes';

interface DiscoverProfile {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  vibeId: string;
  isPro?: boolean;
  isVerified?: boolean;
  url: string;
  updatedAt?: string;
}

export const DiscoverPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [profiles, setProfiles] = useState<DiscoverProfile[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [failedAvatars, setFailedAvatars] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  usePageMeta({
    title: 'Discover Creators & Public Profiles | Iveo',
    description:
      'Explore public creator profiles, digital portfolios, and personal link pages built with Iveo.',
    canonical: `${SITE_ORIGIN}/discover`,
    robots: 'index, follow',
  });

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    const trimmed = query.trim();
    const qs = trimmed ? `?q=${encodeURIComponent(trimmed)}` : '';

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/discover${qs}`);
        const data = await res.json().catch(() => null);
        if (!active) return;
        if (!res.ok || !data?.ok || !Array.isArray(data.profiles)) {
          setError('Could not load creator directory right now.');
          return;
        }
        setProfiles(data.profiles);
        setTotalCount(typeof data.totalCount === 'number' ? data.totalCount : data.profiles.length);
      } catch {
        if (active) setError('Network error while loading creator directory.');
      } finally {
        if (active) setIsLoading(false);
      }
    }, 180);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (value.trim()) {
      setSearchParams({ q: value.trim() }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col">
      <header className="sticky top-0 z-30 h-16 border-b border-border bg-surface/90 backdrop-blur-md">
        <Container className="h-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Logo tone="light" size="md" />
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-2 border border-border text-[12px] font-medium text-muted">
              <Compass size={12} />
              Creator Directory
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <Button as={Link} to="/login" variant="ghost" size="sm">
              Log in
            </Button>
            <Button as={Link} to="/signup" variant="primary" size="sm">
              Claim your link
            </Button>
          </div>
        </Container>
      </header>

      <main className="flex-1 py-12 sm:py-16">
        <Container>
          <div className="max-w-2xl">
            <h1 className="text-[32px] sm:text-[42px] font-semibold tracking-tight text-ink leading-[1.12]">
              Discover Creators on Iveo
            </h1>
            <p className="mt-3 text-[16px] text-muted leading-relaxed">
              Browse public personal spaces, portfolios, and link hubs crafted by designers, musicians, writers, developers, and independent creators.
            </p>

            {/* Search Input */}
            <div className="mt-6 relative max-w-md">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Search creators by name, handle, or craft..."
                aria-label="Search creators"
                className="w-full h-11 pl-10 pr-4 bg-surface border border-border rounded-xl text-[14px] text-ink placeholder:text-subtle focus-visible:outline-2 focus-visible:outline-ink shadow-2xs"
              />
            </div>
            {!isLoading && !error && profiles.length > 0 && !query.trim() && (
              <p className="mt-3 text-[13px] text-muted">
                {totalCount > profiles.length
                  ? `Showing ${profiles.length} featured creators out of ${totalCount} — search above to find any creator on Iveo.`
                  : `Showing ${profiles.length} creator${profiles.length === 1 ? '' : 's'} on Iveo.`}
              </p>
            )}
          </div>

          {isLoading ? (
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-36 rounded-2xl border border-border bg-surface p-5 animate-pulse flex flex-col justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-surface-2" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-28 bg-surface-2 rounded" />
                      <div className="h-3 w-20 bg-surface-2 rounded" />
                    </div>
                  </div>
                  <div className="h-3 w-4/5 bg-surface-2 rounded" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="mt-10 p-6 rounded-2xl border border-border bg-surface text-center">
              <p className="text-[14px] text-muted">{error}</p>
            </div>
          ) : profiles.length === 0 ? (
            <div className="mt-10 p-10 rounded-2xl border border-border bg-surface text-center max-w-lg mx-auto">
              <Sparkles size={24} className="mx-auto text-muted mb-2" />
              <h2 className="text-[18px] font-semibold text-ink">No matching profiles found</h2>
              <p className="mt-1 text-[14px] text-muted">
                {query.trim()
                  ? `Nothing matched "${query.trim()}". Want to claim iveo.site/@${query
                      .trim()
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, '')}?`
                  : 'No public profiles listed yet.'}
              </p>
              <div className="mt-5 flex justify-center gap-2">
                {query.trim() && (
                  <Button variant="secondary" size="sm" onClick={() => handleQueryChange('')}>
                    Reset search
                  </Button>
                )}
                <Button as={Link} to="/signup" variant="primary" size="sm">
                  Create your page
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {profiles.map((profile) => {
                const vibe = VIBES.find((v) => v.id === profile.vibeId) || VIBES[0];
                const initial = (profile.displayName || profile.username || 'I')
                  .charAt(0)
                  .toUpperCase();

                return (
                  <Link
                    key={profile.username}
                    to={`/@${encodeURIComponent(profile.username)}`}
                    className="group rounded-2xl border border-border bg-surface p-5 flex flex-col justify-between gap-4 hover:border-ink/40 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {profile.avatarUrl && !failedAvatars[profile.username] ? (
                          <img
                            src={profile.avatarUrl}
                            alt={profile.displayName}
                            className="w-11 h-11 rounded-full object-cover border border-border shrink-0"
                            loading="lazy"
                            onError={() =>
                              setFailedAvatars((prev) => ({
                                ...prev,
                                [profile.username]: true,
                              }))
                            }
                          />
                        ) : (
                          <div
                            className="w-11 h-11 rounded-full flex items-center justify-center font-semibold text-[16px] shrink-0 border border-border"
                            style={{
                              backgroundColor: vibe.tokens.bg,
                              color: vibe.tokens.text,
                            }}
                          >
                            {initial}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h2 className="text-[16px] font-semibold text-ink truncate group-hover:underline underline-offset-2">
                            {profile.displayName}
                          </h2>
                          <p className="inline-flex items-center gap-1.5 text-[12px] font-mono text-muted max-w-full">
                            <span className="truncate">iveo.site/@{profile.username}</span>
                            {(profile.isVerified || profile.isPro) && <VerifiedTick size={13} />}
                          </p>
                        </div>
                      </div>

                      <ArrowUpRight
                        size={16}
                        className="text-muted group-hover:text-ink group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0"
                      />
                    </div>

                    <p className="text-[13px] text-muted line-clamp-2 leading-relaxed">
                      {profile.bio ||
                        `Explore links, social profiles, and projects by ${profile.displayName}.`}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-border/70 text-[11px] text-subtle">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black/15"
                          style={{ backgroundColor: vibe.tokens.bg }}
                        />
                        <span>{vibe.name} vibe</span>
                      </span>
                      <span className="font-medium text-ink/80">Visit page</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Container>
      </main>

      <Footer />
    </div>
  );
};

export default DiscoverPage;
