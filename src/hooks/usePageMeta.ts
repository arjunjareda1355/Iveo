import { useEffect } from 'react';

interface PageMetaOptions {
  title?: string;
  description?: string;
  robots?: string;
}

export function usePageMeta(options: PageMetaOptions | string) {
  const title = typeof options === 'string' ? options : options.title;
  const description = typeof options === 'object' ? options.description : undefined;
  const robots = typeof options === 'object' ? options.robots : undefined;

  useEffect(() => {
    // 1. Title
    const prevTitle = document.title;
    if (title) {
      document.title = title;
    }

    // 2. Description
    let prevDesc: string | null = null;
    let descMeta: HTMLMetaElement | null = null;
    if (description) {
      descMeta = document.querySelector('meta[name="description"]');
      if (descMeta) {
        prevDesc = descMeta.getAttribute('content');
        descMeta.setAttribute('content', description);
      }
    }

    // 3. Robots
    let prevRobots: string | null = null;
    let robotsMeta: HTMLMetaElement | null = null;
    if (robots) {
      robotsMeta = document.querySelector('meta[name="robots"]');
      if (!robotsMeta) {
        robotsMeta = document.createElement('meta');
        robotsMeta.name = 'robots';
        document.head.appendChild(robotsMeta);
      } else {
        prevRobots = robotsMeta.getAttribute('content');
      }
      robotsMeta.setAttribute('content', robots);
    }

    return () => {
      if (title) {
        document.title = prevTitle;
      }
      if (descMeta && prevDesc !== null) {
        descMeta.setAttribute('content', prevDesc);
      }
      if (robotsMeta) {
        if (prevRobots !== null) {
          robotsMeta.setAttribute('content', prevRobots);
        } else {
          robotsMeta.setAttribute('content', 'index, follow');
        }
      }
    };
  }, [title, description, robots]);
}
