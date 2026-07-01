import type { RequestTemplate } from '../../api/requestTemplates';

interface RequestTemplatePickerProps {
  templates: RequestTemplate[];
  selectedId: number | null;
  onSelect: (template: RequestTemplate | null) => void;
  requesterMode?: boolean;
}

export function RequestTemplatePicker({
  templates,
  selectedId,
  onSelect,
  requesterMode = false,
}: RequestTemplatePickerProps) {
  if (templates.length === 0) {
    return (
      <p className="form-hint template-picker-empty">
        {requesterMode
          ? 'Шаблоны заявок пока не настроены. Заполните форму вручную.'
          : 'Нет доступных шаблонов. Заполните форму вручную или создайте шаблон в разделе «Шаблоны заявок».'}
      </p>
    );
  }

  return (
    <div className="template-picker">
      <p className="template-picker-label">
        {requesterMode ? 'Выберите шаблон заявки' : 'Шаблон'}
      </p>
      <div className="template-picker-grid" role="listbox" aria-label="Шаблоны заявок">
        <button
          type="button"
          role="option"
          aria-selected={selectedId === null}
          className={`template-card${selectedId === null ? ' template-card--active' : ''}`}
          onClick={() => onSelect(null)}
        >
          <span className="template-card-name">Без шаблона</span>
          <span className="template-card-meta">Заполнить вручную</span>
        </button>
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            role="option"
            aria-selected={selectedId === t.id}
            className={`template-card${selectedId === t.id ? ' template-card--active' : ''}`}
            onClick={() => onSelect(t)}
          >
            <span className="template-card-name">{t.name}</span>
            <span className="template-card-meta">
              {[t.group_name, t.title].filter(Boolean).join(' · ')}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
