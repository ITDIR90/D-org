/** Ask whether to save before leaving. Returns: 'save' | 'discard' | 'stay' */
export function askSaveOrDiscard(message: string): 'save' | 'discard' {
  // OK = save, Cancel = discard without saving
  return window.confirm(message) ? 'save' : 'discard';
}

export function isFormChanged(current: unknown, baseline: unknown): boolean {
  return JSON.stringify(current) !== JSON.stringify(baseline);
}
