interface GroupMultiSelectProps {
  groups: { id: number; name: string }[];
  selected: number[];
  onChange: (ids: number[]) => void;
  label: string;
  hint?: string;
}

export function GroupMultiSelect({ groups, selected, onChange, label, hint }: GroupMultiSelectProps) {
  const toggle = (id: number) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  const selectedNames = groups.filter((g) => selected.includes(g.id)).map((g) => g.name);

  return (
    <div className="form-group">
      <label>{label}</label>
      {hint && <p className="form-hint">{hint}</p>}
      {groups.length === 0 ? (
        <p className="empty-inline">Нет доступных групп</p>
      ) : (
        <div className="group-list-select" role="listbox" aria-multiselectable="true">
          {groups.map((g) => (
            <label key={g.id} className="group-list-item">
              <input
                type="checkbox"
                checked={selected.includes(g.id)}
                onChange={() => toggle(g.id)}
              />
              <span>{g.name}</span>
            </label>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <p className="selected-summary">
          Выбрано ({selected.length}): {selectedNames.join(', ')}
        </p>
      )}
    </div>
  );
}
