import { useMemo } from 'react';
import type { EmployeeEfficiencyRow } from '../../api/reports';
import { formatHours, onTimeBarBg, onTimeColor, shortName } from '../../utils/formatDuration';

interface Props {
  rows: EmployeeEfficiencyRow[];
  periodDays: number;
}

interface Summary {
  totalCompleted: number;
  avgOnTime: number | null;
  teamAvgHours: number | null;
  topPerformer: EmployeeEfficiencyRow | null;
}

function computeSummary(rows: EmployeeEfficiencyRow[]): Summary {
  if (rows.length === 0) {
    return { totalCompleted: 0, avgOnTime: null, teamAvgHours: null, topPerformer: null };
  }
  const totalCompleted = rows.reduce((s, r) => s + r.completed_count, 0);
  const onTimeWeighted = rows.reduce((s, r) => s + (r.on_time_percent ?? 0) * r.completed_count, 0);
  const avgOnTime = totalCompleted ? Math.round((onTimeWeighted / totalCompleted) * 10) / 10 : null;
  const hoursRows = rows.filter((r) => r.avg_completion_hours != null);
  const teamAvgHours = hoursRows.length
    ? Math.round(
        (hoursRows.reduce((s, r) => s + (r.avg_completion_hours ?? 0) * r.completed_count, 0) / totalCompleted) * 10,
      ) / 10
    : null;
  const topPerformer = [...rows].sort((a, b) => {
    const scoreA = a.completed_count * ((a.on_time_percent ?? 0) / 100);
    const scoreB = b.completed_count * ((b.on_time_percent ?? 0) / 100);
    return scoreB - scoreA || b.completed_count - a.completed_count;
  })[0];
  return { totalCompleted, avgOnTime, teamAvgHours, topPerformer };
}

function PerformanceMatrix({ rows }: { rows: EmployeeEfficiencyRow[] }) {
  const W = 520;
  const H = 320;
  const pad = { top: 28, right: 28, bottom: 44, left: 52 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const { points, midX, midY, maxCount } = useMemo(() => {
    const counts = rows.map((r) => r.completed_count);
    const max = Math.max(...counts, 1);
    const midCount = max / 2;
    const midOnTime = 75;
    const pts = rows.map((row) => ({
      row,
      x: pad.left + (row.completed_count / max) * innerW,
      y: pad.top + innerH - ((row.on_time_percent ?? 0) / 100) * innerH,
    }));
    return {
      points: pts,
      midX: pad.left + (midCount / max) * innerW,
      midY: pad.top + innerH - (midOnTime / 100) * innerH,
      maxCount: max,
    };
  }, [rows, innerH, innerW, pad.left, pad.top]);

  return (
    <div className="eff-chart-card">
      <div className="eff-chart-card-head">
        <h3>Матрица эффективности</h3>
        <p>Объём выполненных задач и доля закрытий в срок</p>
      </div>
      <div className="eff-matrix-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="eff-matrix" role="img" aria-label="Матрица эффективности сотрудников">
          <rect x={pad.left} y={pad.top} width={innerW} height={innerH} className="eff-matrix-bg" rx="8" />
          <line x1={midX} y1={pad.top} x2={midX} y2={pad.top + innerH} className="eff-matrix-grid" strokeDasharray="4 4" />
          <line x1={pad.left} y1={midY} x2={pad.left + innerW} y2={midY} className="eff-matrix-grid" strokeDasharray="4 4" />

          <text x={pad.left + innerW * 0.75} y={pad.top + 16} className="eff-matrix-label eff-matrix-label--q">Звёзды</text>
          <text x={pad.left + 8} y={pad.top + 16} className="eff-matrix-label">Надёжные</text>
          <text x={pad.left + innerW * 0.75} y={pad.top + innerH - 8} className="eff-matrix-label eff-matrix-label--warn">Много задач</text>
          <text x={pad.left + 8} y={pad.top + innerH - 8} className="eff-matrix-label eff-matrix-label--warn">Нужно внимание</text>

          {[0, 25, 50, 75, 100].map((tick) => (
            <g key={tick}>
              <line
                x1={pad.left - 4}
                y1={pad.top + innerH - (tick / 100) * innerH}
                x2={pad.left}
                y2={pad.top + innerH - (tick / 100) * innerH}
                className="eff-matrix-tick"
              />
              <text
                x={pad.left - 8}
                y={pad.top + innerH - (tick / 100) * innerH + 4}
                textAnchor="end"
                className="eff-matrix-axis"
              >
                {tick}%
              </text>
            </g>
          ))}

          {points.map(({ row, x, y }) => (
            <g key={row.user_id} className="eff-matrix-point">
              <circle
                cx={x}
                cy={y}
                r={7 + Math.min(row.completed_count, 12) * 0.4}
                fill={onTimeBarBg(row.on_time_percent)}
                fillOpacity={0.85}
                stroke="var(--color-surface)"
                strokeWidth={2}
              />
              <title>
                {row.full_name}
                {'\n'}
                Выполнено: {row.completed_count}
                {'\n'}
                В срок: {row.on_time_percent ?? '—'}%
                {'\n'}
                Среднее время: {formatHours(row.avg_completion_hours)}
              </title>
            </g>
          ))}

          <text x={pad.left + innerW / 2} y={H - 8} textAnchor="middle" className="eff-matrix-axis-title">
            Выполнено задач (макс. {maxCount})
          </text>
        </svg>
        <ul className="eff-matrix-legend">
          {rows.slice(0, 8).map((row) => (
            <li key={row.user_id}>
              <span className="eff-matrix-legend-dot" style={{ background: onTimeBarBg(row.on_time_percent) }} />
              {shortName(row.full_name, 18)}
            </li>
          ))}
          {rows.length > 8 && <li className="eff-matrix-legend-more">+ ещё {rows.length - 8}</li>}
        </ul>
      </div>
    </div>
  );
}

function HorizontalBars({
  title,
  subtitle,
  rows,
  valueKey,
  maxLabel,
  formatValue,
  colorForRow,
}: {
  title: string;
  subtitle: string;
  rows: EmployeeEfficiencyRow[];
  valueKey: 'completed_count' | 'avg_completion_hours' | 'on_time_percent';
  maxLabel?: string;
  formatValue: (v: number) => string;
  colorForRow: (row: EmployeeEfficiencyRow) => string;
}) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => (b[valueKey] ?? 0) - (a[valueKey] ?? 0)),
    [rows, valueKey],
  );
  const maxVal = Math.max(...sorted.map((r) => r[valueKey] ?? 0), 0.001);

  return (
    <div className="eff-chart-card">
      <div className="eff-chart-card-head">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <div className="eff-bars">
        {sorted.map((row) => {
          const val = row[valueKey] ?? 0;
          const pct = (val / maxVal) * 100;
          return (
            <div key={row.user_id} className="eff-bar-row">
              <span className="eff-bar-label" title={row.full_name}>{shortName(row.full_name)}</span>
              <div className="eff-bar-track">
                <div
                  className="eff-bar-fill"
                  style={{ width: `${pct}%`, background: colorForRow(row) }}
                />
              </div>
              <span className="eff-bar-value">{formatValue(val)}{maxLabel && valueKey !== 'on_time_percent' ? '' : ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EmployeeEfficiencyChart({ rows, periodDays }: Props) {
  const summary = useMemo(() => computeSummary(rows), [rows]);

  if (rows.length === 0) return null;

  return (
    <div className="eff-dashboard">
      <div className="eff-kpi-grid">
        <div className="eff-kpi">
          <span className="eff-kpi-label">Выполнено за {periodDays} дн.</span>
          <strong className="eff-kpi-value">{summary.totalCompleted}</strong>
          <span className="eff-kpi-hint">задач всего</span>
        </div>
        <div className="eff-kpi">
          <span className="eff-kpi-label">В срок (среднее)</span>
          <strong className="eff-kpi-value" style={{ color: onTimeColor(summary.avgOnTime) }}>
            {summary.avgOnTime != null ? `${summary.avgOnTime}%` : '—'}
          </strong>
          <span className="eff-kpi-hint">взвешенное по объёму</span>
        </div>
        <div className="eff-kpi">
          <span className="eff-kpi-label">Среднее время</span>
          <strong className="eff-kpi-value">{formatHours(summary.teamAvgHours)}</strong>
          <span className="eff-kpi-hint">от создания до закрытия</span>
        </div>
        <div className="eff-kpi eff-kpi--highlight">
          <span className="eff-kpi-label">Лидер периода</span>
          <strong className="eff-kpi-value eff-kpi-value--name">
            {summary.topPerformer ? shortName(summary.topPerformer.full_name, 20) : '—'}
          </strong>
          <span className="eff-kpi-hint">
            {summary.topPerformer
              ? `${summary.topPerformer.completed_count} задач · ${summary.topPerformer.on_time_percent ?? 0}% в срок`
              : '—'}
          </span>
        </div>
      </div>

      <div className="eff-charts-grid">
        <PerformanceMatrix rows={rows} />
        <HorizontalBars
          title="Объём работы"
          subtitle="Количество закрытых задач по сотрудникам"
          rows={rows}
          valueKey="completed_count"
          formatValue={(v) => String(Math.round(v))}
          colorForRow={(row) => onTimeBarBg(row.on_time_percent)}
        />
        <HorizontalBars
          title="Скорость выполнения"
          subtitle="Среднее время от создания до закрытия (меньше — быстрее)"
          rows={rows.filter((r) => r.avg_completion_hours != null)}
          valueKey="avg_completion_hours"
          formatValue={(v) => formatHours(v)}
          colorForRow={() => 'var(--color-steel)'}
        />
        <HorizontalBars
          title="Дисциплина сроков"
          subtitle="Доля задач, закрытых до дедлайна"
          rows={rows}
          valueKey="on_time_percent"
          formatValue={(v) => `${Math.round(v)}%`}
          colorForRow={(row) => onTimeBarBg(row.on_time_percent)}
        />
      </div>

      <div className="eff-legend-strip">
        <span><i className="eff-legend-swatch" style={{ background: 'var(--color-success)' }} /> ≥85% в срок</span>
        <span><i className="eff-legend-swatch" style={{ background: 'var(--color-warning)' }} /> 60–84%</span>
        <span><i className="eff-legend-swatch" style={{ background: 'var(--color-danger)' }} /> &lt;60%</span>
      </div>
    </div>
  );
}
