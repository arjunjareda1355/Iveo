import React, { useEffect, useRef } from 'react';

const CSS = `
  .iveo-links{
    --il-bg:#F5F5F5;
    --il-surface:#FFFFFF;
    --il-border:#E5E5E5;
    --il-text:#0A0A0A;
    --il-muted:#666666;
    --il-dots:#B5B5B5;
    --il-mono:'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

    container-type:inline-size;
    box-sizing:border-box;
    width:100%;
    aspect-ratio:322/193;
    background:var(--il-bg);
    border:1px solid var(--il-border);
    border-radius:10px;
    overflow:hidden;
    position:relative;
  }
  .iveo-links *{box-sizing:border-box}

  .iveo-links .il-row{
    position:absolute;left:9cqw;width:82cqw;top:0;height:13cqw;
    display:flex;align-items:center;gap:3.5cqw;
    padding:0 5cqw;
    background:var(--il-surface);
    border:1px solid var(--il-border);
    border-radius:3cqw;
    font-size:4.2cqw;color:var(--il-text);
    box-shadow:0 1px 2px rgba(0,0,0,.04);
    transform:translateY(var(--y,0cqw)) scale(var(--s,1));
    transition:transform .55s cubic-bezier(.2,.8,.2,1), box-shadow .3s, opacity .4s;
    z-index:1;
    will-change:transform;
  }
  .iveo-links .il-row.is-hidden{opacity:0;--s:.96}
  .iveo-links .il-row.is-drag{
    --s:1.035;z-index:3;
    box-shadow:0 2.4cqw 6cqw rgba(0,0,0,.14), 0 .4cqw 1.2cqw rgba(0,0,0,.08);
  }

  .iveo-links .il-grip{
    display:grid;grid-template-columns:repeat(2,.8cqw);gap:.7cqw;flex:none;
  }
  .iveo-links .il-grip i{width:.8cqw;height:.8cqw;border-radius:50%;background:var(--il-dots)}

  .iveo-links .il-title{white-space:nowrap;display:flex;align-items:center}
  .iveo-links .il-title.is-url{font-family:var(--il-mono);font-size:3.6cqw;color:var(--il-muted)}
  .iveo-links .il-caret{width:1px;height:1.2em;margin-left:1px;background:var(--il-text);opacity:0}
  .iveo-links.is-typing .il-caret{opacity:1;animation:il-blink 1s steps(1) infinite}

  .iveo-links .il-cursor{
    position:absolute;left:0;top:0;width:5.5cqw;height:5.5cqw;z-index:5;pointer-events:none;
    transform:translate(var(--cx,70cqw),var(--cy,56cqw));
    transition:transform .6s cubic-bezier(.4,0,.2,1), opacity .3s;
    opacity:0;filter:drop-shadow(0 .3cqw .5cqw rgba(0,0,0,.25));
  }
  .iveo-links .il-cursor.is-on{opacity:1}
  .iveo-links .il-cursor.is-press{transition:transform .55s cubic-bezier(.2,.8,.2,1), opacity .3s}
  .iveo-links.is-fade .il-row{opacity:0}

  @keyframes il-blink{50%{opacity:0}}
  @media (prefers-reduced-motion:reduce){
    .iveo-links *{animation:none!important;transition:none!important}
  }
`;

export const AddLinksAnimation: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const portfolioRef = useRef<HTMLDivElement>(null);
  const shopRef = useRef<HTMLDivElement>(null);
  const newsRef = useRef<HTMLDivElement>(null);
  const newsTitleRef = useRef<HTMLSpanElement>(null);
  const newsTextRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const portfolio = portfolioRef.current;
    const shop = shopRef.current;
    const news = newsRef.current;
    const titleEl = newsTitleRef.current;
    const textEl = newsTextRef.current;
    const cursor = cursorRef.current;
    if (!root || !portfolio || !shop || !news || !titleEl || !textEl || !cursor) return;

    const rows: Record<'portfolio' | 'shop' | 'news', HTMLDivElement> = {
      portfolio,
      shop,
      news,
    };
    const TOP = 7.5;
    const PITCH = 16;
    let running = false;
    let destroyed = false;
    let inView = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let resolvePending: (() => void) | null = null;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function wait(ms: number) {
      return new Promise<void>((resolve) => {
        if (!running || destroyed) {
          resolve();
          return;
        }
        resolvePending = resolve;
        timer = setTimeout(() => {
          resolvePending = null;
          resolve();
        }, ms);
      });
    }

    function slot(el: HTMLDivElement, n: number) {
      el.style.setProperty('--y', `${TOP + n * PITCH}cqw`);
    }

    function layout(order: Array<'portfolio' | 'shop' | 'news'>) {
      order.forEach((id, n) => slot(rows[id], n));
    }

    function moveCursor(x: number, y: number) {
      cursor!.style.setProperty('--cx', `${x}cqw`);
      cursor!.style.setProperty('--cy', `${y}cqw`);
    }

    async function typeInto(txt: string, speed: number) {
      for (let k = 1; k <= txt.length && running && !destroyed; k++) {
        textEl!.textContent = txt.slice(0, k);
        await wait(speed + Math.random() * 40);
      }
    }

    function reset() {
      root!.classList.remove('is-fade', 'is-typing');
      (Object.keys(rows) as Array<keyof typeof rows>).forEach((k) =>
        rows[k].classList.remove('is-drag')
      );
      textEl!.textContent = '';
      titleEl!.classList.remove('is-url');
      cursor!.classList.remove('is-on', 'is-press');
      moveCursor(72, 58);
      const allRows = [portfolio!, shop!, news!];
      allRows.forEach((r) => {
        r.style.transition = 'none';
      });
      layout(['portfolio', 'shop', 'news']);
      news!.classList.add('is-hidden');
      void root!.offsetWidth;
      allRows.forEach((r) => {
        r.style.transition = '';
      });
    }

    async function loop() {
      if (running || destroyed || document.hidden) return;
      running = true;
      while (running && !destroyed) {
        reset();
        await wait(700);
        if (!running || destroyed) break;
        news!.classList.remove('is-hidden');
        titleEl!.classList.add('is-url');
        root!.classList.add('is-typing');
        await wait(350);
        if (!running || destroyed) break;
        await typeInto('iveo.site/news', 55);
        if (!running || destroyed) break;
        await wait(450);
        if (!running || destroyed) break;
        textEl!.textContent = '';
        titleEl!.classList.remove('is-url');
        await typeInto('Newsletter', 85);
        if (!running || destroyed) break;
        await wait(300);
        if (!running || destroyed) break;
        root!.classList.remove('is-typing');
        cursor!.classList.add('is-on');
        moveCursor(13, TOP + 2 * PITCH + 3.5);
        await wait(750);
        if (!running || destroyed) break;
        cursor!.classList.add('is-press');
        news!.classList.add('is-drag');
        await wait(250);
        if (!running || destroyed) break;
        moveCursor(13, TOP + 3.5);
        slot(news!, 0);
        slot(rows.portfolio, 1);
        slot(rows.shop, 2);
        await wait(800);
        if (!running || destroyed) break;
        news!.classList.remove('is-drag');
        await wait(250);
        if (!running || destroyed) break;
        moveCursor(60, 52);
        cursor!.classList.remove('is-on');
        await wait(2400);
        if (!running || destroyed) break;
        root!.classList.add('is-fade');
        await wait(600);
      }
      running = false;
    }

    function stop() {
      running = false;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (resolvePending) {
        const fn = resolvePending;
        resolvePending = null;
        fn();
      }
    }

    if (reduce) {
      news.classList.remove('is-hidden');
      textEl.textContent = 'Newsletter';
      layout(['news', 'portfolio', 'shop']);
      return;
    }

    layout(['portfolio', 'shop', 'news']);

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else if (inView) {
        void loop();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    let observer: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (entries) => {
          inView = Boolean(entries[0]?.isIntersecting);
          if (inView && !document.hidden) {
            void loop();
          } else {
            stop();
          }
        },
        { threshold: 0.35 }
      );
      observer.observe(root);
    } else {
      inView = true;
      void loop();
    }

    return () => {
      destroyed = true;
      stop();
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <>
      <style>{CSS}</style>
      <div
        ref={rootRef}
        className="iveo-links"
        role="img"
        aria-label="Adding a link and dragging it into place"
      >
        <div ref={portfolioRef} className="il-row" data-id="portfolio">
          <span className="il-grip" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="il-title">Portfolio</span>
        </div>
        <div ref={shopRef} className="il-row" data-id="shop">
          <span className="il-grip" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="il-title">Shop prints</span>
        </div>
        <div ref={newsRef} className="il-row is-hidden" data-id="news">
          <span className="il-grip" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <span ref={newsTitleRef} className="il-title">
            <span ref={newsTextRef} className="il-text" />
            <span className="il-caret" />
          </span>
        </div>

        <svg ref={cursorRef} className="il-cursor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M5 3l14 8-6 1.8L10.6 19z"
            fill="#111"
            stroke="#fff"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </>
  );
};
