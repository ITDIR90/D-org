import { useEffect, useRef } from 'react';

const SYMBOLS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789';

export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let columns = 0;
    let drops: number[] = [];
    let fontSize = 16;
    let raf = 0;
    let running = false;
    let lastTime = 0;
    const FRAME_INTERVAL = 50; // ms — неспешный дождь
    const DPR = window.devicePixelRatio || 1;

    const isMatrix = () =>
      document.documentElement.getAttribute('data-theme') === 'matrix';

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      width = parent.clientWidth;
      height = parent.clientHeight;
      canvas.width = width * DPR;
      canvas.height = height * DPR;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      columns = Math.ceil(width / fontSize);
      drops = Array(columns).fill(0).map(() => Math.floor(Math.random() * -50));
    };

    const draw = (time: number) => {
      if (!running) return;
      raf = requestAnimationFrame(draw);
      if (time - lastTime < FRAME_INTERVAL) return;
      lastTime = time;

      // лёгкий след (не полная очистка, а полупрозрачная заливка)
      ctx.fillStyle = 'rgba(2, 6, 3, 0.12)';
      ctx.fillRect(0, 0, width, height);
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < columns; i++) {
        const char = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        // "голова" столбца — ярче
        ctx.fillStyle = 'rgba(160, 255, 180, 0.55)';
        ctx.fillText(String.fromCharCode(0x3080 + Math.floor(Math.random() * 80)), x, y);
        // хвост — тусклый зелёный
        ctx.fillStyle = 'rgba(0, 255, 65, 0.18)';
        ctx.fillText(char, x, y - fontSize);

        if (y > height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    const start = () => {
      if (running) return;
      running = true;
      resize();
      raf = requestAnimationFrame(draw);
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, width, height);
    };

    if (isMatrix()) {
      start();
    }

    const observer = new MutationObserver(() => {
      if (isMatrix()) start();
      else stop();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    window.addEventListener('resize', resize);

    return () => {
      stop();
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="matrix-rain" aria-hidden />;
}
