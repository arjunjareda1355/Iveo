import React, { useEffect, useRef } from 'react';

const CSS = `
  .iveo-vibe{
    --iv-bg:#F5F5F5;
    --iv-ring:#0A0A0A;
    --iv-gap:#F5F5F5;

    container-type:inline-size;
    box-sizing:border-box;
    width:100%;
    aspect-ratio:322/193;
    background:var(--iv-bg);
    border:1px solid #E5E5E5;
    border-radius:10px;
    overflow:hidden;
    position:relative;
    display:flex;align-items:center;justify-content:center;
  }
  .iveo-vibe *{box-sizing:border-box}

  .iveo-vibe .iv-tiles{display:flex;gap:2.8cqw}

  .iveo-vibe .iv-tile{
    width:20.5cqw;height:26.5cqw;
    border-radius:3cqw;
    border:1px solid var(--t-border);
    background:var(--t-bg);
    display:flex;flex-direction:column;align-items:center;
    padding-top:5.2cqw;gap:2.2cqw;
    transition:transform .35s cubic-bezier(.2,.8,.2,1), box-shadow .35s;
  }
  .iveo-vibe .iv-tile.is-selected{
    transform:scale(1.04);
    box-shadow:0 0 0 .6cqw var(--iv-gap), 0 0 0 1.3cqw var(--iv-ring);
  }
  .iveo-vibe .iv-tile.is-press{transform:scale(.95)}

  .iveo-vibe .iv-av{width:5.6cqw;height:5.6cqw;border-radius:50%;background:var(--t-av)}
  .iveo-vibe .iv-bar{width:14.5cqw;height:2cqw;border-radius:1cqw;background:var(--t-bar)}
  .iveo-vibe .iv-bar.is-line{
    height:2.6cqw;background:transparent;border:1px solid var(--t-bar);border-radius:1.4cqw;
  }

  .iveo-vibe .t-paper {--t-bg:#fff;   --t-border:#e4e4e4;--t-av:#e6e6e6;--t-bar:#111}
  .iveo-vibe .t-night {--t-bg:#141414;--t-border:#141414;--t-av:#3a3a3a;--t-bar:#4a4a4a}
  .iveo-vibe .t-cream {--t-bg:#f5f0e3;--t-border:#e3dcc8;--t-av:#dcd5c0;--t-bar:#8c8571}
  .iveo-vibe .t-sage  {--t-bg:#e7ece3;--t-border:#d2dacc;--t-av:#cfd8c9;--t-bar:#7f8c78}

  .iveo-vibe .iv-cursor{
    position:absolute;left:0;top:0;width:5.5cqw;height:5.5cqw;z-index:5;pointer-events:none;
    transform:translate(var(--cx,80cqw),var(--cy,52cqw));
    transition:transform .7s cubic-bezier(.4,0,.2,1), opacity .3s;
    opacity:0;filter:drop-shadow(0 .3cqw .5cqw rgba(0,0,0,.25));
  }
  .iveo-vibe .iv-cursor.is-on{opacity:1}

  @media (prefers-reduced-motion:reduce){
    .iveo-vibe *{transition:none!important;animation:none!important}
  }
`;

export const ChooseVibeAnimation: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<Array<HTMLDivElement | null>>([]);
  const cursorRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const cursor = cursorRef.current;
    const tiles = tileRefs.current.filter((t): t is HTMLDivElement => t !== null);
    if (!root || !cursor || tiles.length === 0) return;

    const order = [1, 2, 3, 0];
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

    function select(i: number) {
      tiles.forEach((t, k) => t.classList.toggle('is-selected', k === i));
    }

    function aim(i: number) {
      const x = 4.8 + i * 23.3 + 12;
      const y = 16.75 + 17;
      cursor!.style.setProperty('--cx', `${x}cqw`);
      cursor!.style.setProperty('--cy', `${y}cqw`);
    }

    async function loop() {
      if (running || destroyed || document.hidden) return;
      running = true;
      cursor!.classList.add('is-on');
      await wait(900);
      while (running && !destroyed) {
        for (let n = 0; n < order.length && running && !destroyed; n++) {
          const i = order[n];
          aim(i);
          await wait(800);
          if (!running || destroyed) break;
          tiles[i].classList.add('is-press');
          await wait(140);
          if (!running || destroyed) break;
          tiles[i].classList.remove('is-press');
          select(i);
          await wait(1500);
        }
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
      select(1);
      return;
    }

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
        className="iveo-vibe"
        role="img"
        aria-label="Choosing between four ready-made page styles"
      >
        <div className="iv-tiles">
          <div
            ref={(el) => {
              tileRefs.current[0] = el;
            }}
            className="iv-tile t-paper is-selected"
          >
            <span className="iv-av" />
            <span className="iv-bar" />
            <span className="iv-bar" />
          </div>
          <div
            ref={(el) => {
              tileRefs.current[1] = el;
            }}
            className="iv-tile t-night"
          >
            <span className="iv-av" />
            <span className="iv-bar" />
            <span className="iv-bar" />
          </div>
          <div
            ref={(el) => {
              tileRefs.current[2] = el;
            }}
            className="iv-tile t-cream"
          >
            <span className="iv-av" />
            <span className="iv-bar is-line" />
            <span className="iv-bar is-line" />
          </div>
          <div
            ref={(el) => {
              tileRefs.current[3] = el;
            }}
            className="iv-tile t-sage"
          >
            <span className="iv-av" />
            <span className="iv-bar is-line" />
            <span className="iv-bar is-line" />
          </div>
        </div>
        <svg ref={cursorRef} className="iv-cursor" viewBox="0 0 24 24" aria-hidden="true">
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
