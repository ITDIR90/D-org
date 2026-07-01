import { useEffect, useMemo, useState } from 'react';
import { listUserActions, clearUserActions } from '../api/chats';
import { SortableTh } from '../components/Table/SortableTh';
import { useTableSort } from '../hooks/useTableSort';

type LogRow = Record<string, unknown>;

const LOG_SORT_ACCESSORS = {
  created_at: (l: LogRow) => new Date(l.created_at as string).getTime(),
  user_name: (l: LogRow) => (l.user_name as string) || '',
  action: (l: LogRow) => (l.action as string) || '',
  details: (l: LogRow) => (l.details as string) || '',
  ip_address: (l: LogRow) => (l.ip_address as string) || '',
};

export function LogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);

  const load = () => listUserActions().then(setLogs).catch(() => {});
  useEffect(() => { load(); }, []);

  const accessors = useMemo(() => LOG_SORT_ACCESSORS, []);
  const { sorted, sortKey, direction, toggleSort } = useTableSort(logs, accessors, 'created_at', 'desc');

  return (
    <div>
      <div className="page-header">
        <h1>Журнал действий пользователей</h1>
        <button className="btn btn-danger" onClick={() => { if (confirm('Очистить журнал?')) clearUserActions().then(load); }}>Очистить журнал</button>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <SortableTh label="Дата" sortKey="created_at" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Пользователь" sortKey="user_name" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Действие" sortKey="action" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Детали" sortKey="details" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="IP" sortKey="ip_address" activeKey={sortKey} direction={direction} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((l) => (
              <tr key={l.id as number}>
                <td>{new Date(l.created_at as string).toLocaleString('ru-RU')}</td>
                <td>{(l.user_name as string) || '—'}</td>
                <td>{l.action as string}</td>
                <td>{(l.details as string) || '—'}</td>
                <td>{(l.ip_address as string) || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
