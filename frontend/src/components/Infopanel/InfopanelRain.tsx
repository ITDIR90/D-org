import { useEffect, useRef } from 'react';

const SYMBOLS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF';

export function InfopanelRain() {
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
    const fontSize = 18;
    let raf = 0;
    let lastTime = 0;
    const FRAME_INTERVAL = 50;
    const DPR = window.devicePixelRatio || 1;

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
      drops = Array(columns).fill(0).map(() => Math.floor(Math.random() * -60));
    };

    const draw = (time: number) => {
      raf = requestAnimationFrame(draw);
      if (time - lastTime < FRAME_INTERVAL) return;
      lastTime = time;

      ctx.fillStyle = 'rgba(2, 10, 4, 0.10)';
      ctx.fillRect(0, 0, width, height);
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < columns; i++) {
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        ctx.fillStyle = 'rgba(140, 255, 165, 0.5)';
        ctx.fillText(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)], x, y);
        ctx.fillStyle = 'rgba(0, 255, 65, 0.14)';
        ctx.fillText(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)], x, y - fontSize);

        if (y > height && Math.random() > 0.968) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    resize();
    raf = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="infopanel-rain" aria-hidden />;
}
