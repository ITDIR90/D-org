import { TIMEZONES, normalizeTimezone } from '../../constants/timezones';

interface TimezoneSelectProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  required?: boolean;
}

export function TimezoneSelect({ value, onChange, id, required }: TimezoneSelectProps) {
  const normalized = normalizeTimezone(value);
  const hasValue = TIMEZONES.some((t) => t.value === normalized);

  return (
    <select
      id={id}
      value={hasValue ? normalized : 'Europe/Moscow'}
      onChange={(e) => onChange(e.target.value)}
      required={required}
    >
      {TIMEZONES.map((tz) => (
        <option key={tz.value} value={tz.value}>
          {tz.label}
        </option>
      ))}
    </select>
  );
}
