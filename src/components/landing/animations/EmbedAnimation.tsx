import React, { useEffect, useMemo, useRef } from 'react';

const CSS = `
  .iveo-embed{
    --ie-bg:#F5F5F5;
    --ie-surface:#FFFFFF;
    --ie-border:#E5E5E5;
    --ie-ink:#0A0A0A;
    --ie-soft:#D4D4D4;
    --ie-mono:'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

    container-type:inline-size;
    box-sizing:border-box;
    width:100%;
    aspect-ratio:232/140;
    background:var(--ie-bg);
    border:1px solid var(--ie-border);
    border-radius:10px;
    overflow:hidden;
    position:relative;
  }
  .iveo-embed *{box-sizing:border-box}

  .iveo-embed .ie-item{
    position:absolute;left:5cqw;width:90cqw;
    opacity:0;transform:translateY(3cqw);
    transition:opacity .5s, transform .55s cubic-bezier(.2,.9,.3,1);
  }
  .iveo-embed.show-v .ie-video, .iveo-embed.show-t .ie-track, .iveo-embed.show-w .ie-wave{opacity:1;transform:none}
  .iveo-embed.is-out .ie-item{opacity:0;transition:opacity .5s}

  .iveo-embed .ie-tag{font-family:var(--ie-mono);font-size:2.3cqw;color:#9a9a9a;letter-spacing:.02em}

  .iveo-embed .ie-video{
    top:5cqw;height:25cqw;background:var(--ie-surface);border:1px solid var(--ie-border);border-radius:3cqw;
    display:flex;align-items:center;justify-content:center;overflow:hidden;
    box-shadow:0 1px 2px rgba(0,0,0,.04);
  }
  .iveo-embed .ie-video .ie-tag{position:absolute;left:3.2cqw;top:2.6cqw}
  .iveo-embed .ie-play{width:8cqw;height:8cqw;position:relative;transition:transform .15s}
  .iveo-embed .ie-play svg{position:absolute;inset:0;width:100%;height:100%;transition:opacity .2s}
  .iveo-embed .ie-play .ie-pause{opacity:0}
  .iveo-embed .ie-video.is-playing .ie-pause{opacity:1}
  .iveo-embed .ie-video.is-playing .ie-tri{opacity:0}
  .iveo-embed .ie-play.is-press{transform:scale(.86)}
  .iveo-embed .ie-vbar{position:absolute;left:3cqw;right:3cqw;bottom:2.6cqw;height:.9cqw;border-radius:1cqw;background:#ececec;overflow:hidden}
  .iveo-embed .ie-vbar i{display:block;height:100%;width:0;background:var(--ie-ink);border-radius:1cqw}
  .iveo-embed .ie-video.is-playing .ie-vbar i{animation:ie-fill 3.2s linear forwards}

  .iveo-embed .ie-track{
    top:33cqw;height:13cqw;display:flex;align-items:center;gap:3cqw;padding:0 3cqw;
    background:var(--ie-surface);border:1px solid var(--ie-border);border-radius:2.6cqw;
    box-shadow:0 1px 2px rgba(0,0,0,.04);
  }
  .iveo-embed .ie-thumb{
    width:7.6cqw;height:7.6cqw;border-radius:1.6cqw;flex:none;background:#f1f1f1;border:1px solid var(--ie-border);
    display:flex;align-items:flex-end;justify-content:center;gap:.7cqw;padding:1.7cqw 0;transition:transform .15s;
  }
  .iveo-embed .ie-thumb.is-press{transform:scale(.88)}
  .iveo-embed .ie-thumb i{width:.9cqw;height:100%;background:var(--ie-ink);border-radius:.4cqw;transform:scaleY(.15);transform-origin:bottom;opacity:.0;transition:opacity .3s}
  .iveo-embed .ie-track.is-playing .ie-thumb i{opacity:1;animation:ie-eq .8s ease-in-out infinite}
  .iveo-embed .ie-track.is-playing .ie-thumb i:nth-child(2){animation-delay:-.3s}
  .iveo-embed .ie-track.is-playing .ie-thumb i:nth-child(3){animation-delay:-.55s}
  .iveo-embed .ie-lines{flex:1;display:flex;flex-direction:column;gap:1.4cqw}
  .iveo-embed .ie-l1{height:1.9cqw;width:36cqw;border-radius:1cqw;background:var(--ie-ink)}
  .iveo-embed .ie-l2{height:1.5cqw;width:22cqw;border-radius:1cqw;background:#d4d4d4}

  .iveo-embed .ie-wave{top:49cqw;height:7cqw;display:flex;align-items:center;justify-content:space-between}
  .iveo-embed .ie-wave i{
    display:block;width:1cqw;border-radius:.5cqw;background:var(--ie-soft);
    transform:scaleY(0);transition:transform .4s cubic-bezier(.2,.9,.3,1.2), background .2s;
  }
  .iveo-embed.show-w .ie-wave i{transform:scaleY(1)}
  .iveo-embed .ie-wave i.is-played{background:var(--ie-ink)}

  .iveo-embed .ie-cursor{
    position:absolute;left:0;top:0;width:5cqw;height:5cqw;z-index:5;pointer-events:none;
    transform:translate(var(--cx,95cqw),var(--cy,58cqw));
    transition:transform .75s cubic-bezier(.4,0,.2,1), opacity .3s;
    opacity:0;filter:drop-shadow(0 .3cqw .5cqw rgba(0,0,0,.25));
  }
  .iveo-embed .ie-cursor.is-on{opacity:1}

  @keyframes ie-fill{from{width:0}to{width:100%}}
  @keyframes ie-eq{0%,100%{transform:scaleY(.2)}50%{transform:scaleY(1)}}
  @media (prefers-reduced-motion:reduce){
    .iveo-embed *{animation:none!important;transition:none!important}
  }
`;

const WAVE_COUNT = 38;

export const EmbedAnimation: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const playRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const waveBarsRef = useRef<Array<HTMLElement | null>>([]);
  const cursorRef = useRef<SVGSVGElement>(null);

  const waveBars = useMemo(
    () =>
      Array.from({ length: WAVE_COUNT }, (_, i) => {
        const h = 2.2 + Math.abs(Math.sin(i * 1.7) * 3.2 + Math.sin(i * 0.6) * 1.6);
        return {
          height: `${Math.min(h, 7)}cqw`,
          transitionDelay: `${i * 18}ms, 0s`,
        };
      }),
    []
  );

  useEffect(() => {
    const root = rootRef.current;
    const video = videoRef.current;
    const play = playRef.current;
    const track = trackRef.current;
    const thumb = thumbRef.current;
    const cursor = cursorRef.current;
    const bars = waveBarsRef.current.filter((b): b is HTMLElement => b !== null);
    if (!root || !video || !play || !track || !thumb || !cursor || bars.length === 0) return;

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

    function aim(el: HTMLElement, fx = 0.5, fy = 0.5) {
      const rr = root!.getBoundingClientRect();
      const cr = el.getBoundingClientRect();
      const u = rr.width / 100;
      if (u <= 0) return;
      cursor!.style.setProperty('--cx', `${(cr.left - rr.left + cr.width * fx) / u - 1}cqw`);
      cursor!.style.setProperty('--cy', `${(cr.top - rr.top + cr.height * fy) / u - 0.7}cqw`);
    }

    async function click(el: HTMLElement) {
      el.classList.add('is-press');
      await wait(150);
      if (!running || destroyed) return;
      el.classList.remove('is-press');
    }

    function reset() {
      ['show-v', 'show-t', 'show-w', 'is-out'].forEach((c) => root!.classList.remove(c));
      video!.classList.remove('is-playing');
      track!.classList.remove('is-playing');
      bars.forEach((b) => b.classList.remove('is-played'));
      cursor!.classList.remove('is-on');
      cursor!.style.setProperty('--cx', '95cqw');
      cursor!.style.setProperty('--cy', '58cqw');
    }

    async function loop() {
      if (running || destroyed || document.hidden) return;
      running = true;
      while (running && !destroyed) {
        reset();
        await wait(700);
        if (!running || destroyed) break;
        root!.classList.add('show-v');
        await wait(550);
        if (!running || destroyed) break;
        root!.classList.add('show-t');
        await wait(550);
        if (!running || destroyed) break;
        root!.classList.add('show-w');
        await wait(1100);
        if (!running || destroyed) break;
        cursor!.classList.add('is-on');
        aim(play!);
        await wait(900);
        if (!running || destroyed) break;
        await click(play!);
        if (!running || destroyed) break;
        video!.classList.add('is-playing');
        await wait(2400);
        if (!running || destroyed) break;
        aim(thumb!);
        await wait(850);
        if (!running || destroyed) break;
        await click(thumb!);
        if (!running || destroyed) break;
        video!.classList.remove('is-playing');
        track!.classList.add('is-playing');
        for (let k = 0; k < WAVE_COUNT && running && !destroyed; k++) {
          bars[k]?.classList.add('is-played');
          await wait(75);
        }
        if (!running || destroyed) break;
        await wait(900);
        if (!running || destroyed) break;
        cursor!.classList.remove('is-on');
        track!.classList.remove('is-playing');
        await wait(500);
        if (!running || destroyed) break;
        root!.classList.add('is-out');
        await wait(800);
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
      root.classList.add('show-v', 'show-t', 'show-w');
      for (let q = 0; q < 14; q++) bars[q]?.classList.add('is-played');
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
        className="iveo-embed"
        role="img"
        aria-label="A video, a music track and a waveform embedded on a page and playing"
      >
        <div ref={videoRef} className="ie-item ie-video">
          <span className="ie-tag">YouTube</span>
          <span ref={playRef} className="ie-play">
            <svg className="ie-tri" viewBox="0 0 24 24">
              <path
                d="M6 3.5v17a1 1 0 0 0 1.5.86l14-8.5a1 1 0 0 0 0-1.72l-14-8.5A1 1 0 0 0 6 3.5z"
                fill="#111"
                stroke="#111"
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
            </svg>
            <svg className="ie-pause" viewBox="0 0 24 24">
              <rect x="5" y="3.5" width="5" height="17" rx="1.4" fill="#111" />
              <rect x="14" y="3.5" width="5" height="17" rx="1.4" fill="#111" />
            </svg>
          </span>
          <span className="ie-vbar">
            <i />
          </span>
        </div>

        <div ref={trackRef} className="ie-item ie-track">
          <span ref={thumbRef} className="ie-thumb">
            <i />
            <i />
            <i />
          </span>
          <span className="ie-lines">
            <span className="ie-l1" />
            <span className="ie-l2" />
          </span>
          <span className="ie-tag">Spotify</span>
        </div>

        <div className="ie-item ie-wave">
          {waveBars.map((bar, idx) => (
            <i
              key={idx}
              ref={(el) => {
                waveBarsRef.current[idx] = el;
              }}
              style={{ height: bar.height, transitionDelay: bar.transitionDelay }}
            />
          ))}
        </div>

        <svg ref={cursorRef} className="ie-cursor" viewBox="0 0 24 24" aria-hidden="true">
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
