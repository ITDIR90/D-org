import { useEffect, useRef } from 'react';

export function useChatScroll(deps: unknown[]) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAnchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, deps);

  return { containerRef, scrollAnchor };
}
