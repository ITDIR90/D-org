type ToastKind = 'success' | 'info' | 'error';

function ensureToastRoot(): HTMLElement {
  let container = document.getElementById('app-toast-root');
  if (!container) {
    container = document.createElement('div');
    container.id = 'app-toast-root';
    container.className = 'toast-root';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message: string, kind: ToastKind = 'info', durationMs = 4500) {
  const container = ensureToastRoot();
  const el = document.createElement('div');
  el.className = `app-toast app-toast--${kind}`;
  el.textContent = message;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('app-toast--visible'));
  window.setTimeout(() => {
    el.classList.remove('app-toast--visible');
    window.setTimeout(() => el.remove(), 320);
  }, durationMs);
}

export function showAiNotice(corrected: boolean) {
  if (corrected) {
    showToast('AI успешно исправил текст', 'info');
  }
}
