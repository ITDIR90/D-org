export const TASKS_CHANGED_EVENT = 'dorg:tasks-changed';

export function notifyTasksChanged() {
  window.dispatchEvent(new Event(TASKS_CHANGED_EVENT));
}
