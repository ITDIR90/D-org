import type { Task } from '../api/tasks';

export type MyTaskFilter = 'in_progress' | 'urgent' | 'done' | 'created_by_me' | 'all' | 'awaiting_confirmation';
export type GroupTaskFilter = 'all' | 'unassigned';
export type RequesterTaskFilter = 'active' | 'awaiting_confirmation' | 'done' | 'cancelled' | 'all';

export const MY_TASK_FILTERS: { id: MyTaskFilter; label: string }[] = [
  { id: 'in_progress', label: 'В работе' },
  { id: 'urgent', label: 'Срочные' },
  { id: 'awaiting_confirmation', label: 'На подтверждении' },
  { id: 'done', label: 'Выполненные' },
  { id: 'created_by_me', label: 'Созданные мной' },
  { id: 'all', label: 'Все задачи' },
];

export function isActiveTask(task: Task) {
  return !['done', 'cancelled', 'archived'].includes(task.status);
}

export function isInProgressTask(task: Task) {
  return ['new', 'in_progress'].includes(task.status);
}

export function isUrgentTask(task: Task) {
  return (task.priority === 'high' || task.priority === 'ferrari') && isActiveTask(task);
}

export function countInProgressTasks(tasks: Task[]) {
  return tasks.filter(isInProgressTask).length;
}

export function countUrgentTasks(tasks: Task[]) {
  return tasks.filter(isUrgentTask).length;
}

export function isAwaitingConfirmationTask(task: Task) {
  return task.status === 'waiting_author_confirmation';
}

export function countAwaitingConfirmationTasks(assignedTasks: Task[], createdTasks: Task[]) {
  const seen = new Set<number>();
  return [...assignedTasks, ...createdTasks].filter((t) => {
    if (!isAwaitingConfirmationTask(t) || seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  }).length;
}

export function sortByCreatedAt(tasks: Task[]) {
  return [...tasks].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function applyMyTaskFilter(
  assignedTasks: Task[],
  createdTasks: Task[],
  filter: MyTaskFilter,
): Task[] {
  switch (filter) {
    case 'created_by_me':
      return sortByCreatedAt(createdTasks);
    case 'all':
      return sortByCreatedAt(assignedTasks);
    case 'in_progress':
      return sortByCreatedAt(assignedTasks.filter(isInProgressTask));
    case 'urgent':
      return sortByCreatedAt(assignedTasks.filter(isUrgentTask));
    case 'awaiting_confirmation': {
      const seen = new Set<number>();
      return sortByCreatedAt(
        [...assignedTasks, ...createdTasks].filter((t) => {
          if (!isAwaitingConfirmationTask(t) || seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        }),
      );
    }
    case 'done':
      return sortByCreatedAt(assignedTasks.filter((t) => t.status === 'done'));
    default:
      return sortByCreatedAt(assignedTasks);
  }
}

export const REQUESTER_TASK_FILTERS: { id: RequesterTaskFilter; label: string }[] = [
  { id: 'active', label: 'В работе' },
  { id: 'awaiting_confirmation', label: 'На подтверждении' },
  { id: 'cancelled', label: 'Отменённые' },
  { id: 'all', label: 'Все заявки' },
];

export function applyRequesterTaskFilter(tasks: Task[], filter: RequesterTaskFilter): Task[] {
  const sorted = sortByCreatedAt(tasks);
  switch (filter) {
    case 'active':
      return sorted.filter((t) => ['new', 'in_progress'].includes(t.status));
    case 'awaiting_confirmation':
      return sorted.filter(isAwaitingConfirmationTask);
    case 'done':
      return sorted.filter((t) => t.status === 'done');
    case 'cancelled':
      return sorted.filter((t) => t.status === 'cancelled');
    case 'all':
    default:
      return sorted;
  }
}

export function countActiveRequesterTasks(tasks: Task[]) {
  return tasks.filter((t) => ['new', 'in_progress'].includes(t.status)).length;
}

export function countAwaitingRequesterTasks(tasks: Task[]) {
  return tasks.filter(isAwaitingConfirmationTask).length;
}

export function countDoneRequesterTasks(tasks: Task[]) {
  return tasks.filter((t) => t.status === 'done').length;
}
