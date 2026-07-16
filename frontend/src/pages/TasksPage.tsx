import { useEffect, useMemo, useState } from 'react';

import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import { listTasks, createTask } from '../api/tasks';

import type { Task } from '../api/tasks';

import { listRequestTemplates, type RequestTemplate } from '../api/requestTemplates';

import { TaskTable } from '../components/TaskTable/TaskTable';

import { Modal } from '../components/Modal/Modal';

import { TaskCreateForm, EMPTY_TASK_FORM } from '../components/TaskForm/TaskCreateForm';

import type { TaskCreateFormData } from '../components/TaskForm/TaskCreateForm';

import { RequestTemplatePicker } from '../components/RequestTemplate/RequestTemplatePicker';

import { TasksSectionNav } from '../components/Tasks/TasksSectionNav';

import { listGroups } from '../api/groups';

import { listCategories } from '../api/categories';

import { listUsers } from '../api/users';

import { useAuth } from '../auth/AuthContext';

import { showAiNotice, showToast } from '../utils/toast';
import { notifyTasksChanged } from '../utils/taskEvents';
import { askSaveOrDiscard, isFormChanged } from '../utils/unsavedChanges';

import { isRequestOnly } from '../constants/roles';

import {

  MY_TASK_FILTERS,

  REQUESTER_TASK_FILTERS,

  applyMyTaskFilter,

  applyRequesterTaskFilter,

  applyGroupTaskFilter,

  sortByCreatedAt,

  type GroupTaskFilter,

  type MyTaskFilter,

  type RequesterTaskFilter,

} from '../utils/taskFilters';



const TITLES: Record<string, string> = {

  my: 'Мои задачи',

  group: 'Задачи моей группы',

  new: 'Новая задача',

  archive: 'Архив задач',

};



const REQUESTER_TITLES: Record<string, string> = {

  my: 'Мои заявки',

  new: 'Новая заявка',

};



const GROUP_FILTERS: { id: GroupTaskFilter; label: string }[] = [

  { id: 'all', label: 'Все' },

  { id: 'unassigned', label: 'Новые' },

  { id: 'done', label: 'Выполненные' },

];



const VALID_GROUP_FILTERS = new Set<GroupTaskFilter>(GROUP_FILTERS.map((f) => f.id));



const VALID_MY_FILTERS = new Set<MyTaskFilter>(MY_TASK_FILTERS.map((f) => f.id));

const VALID_REQUESTER_FILTERS = new Set<RequesterTaskFilter>(REQUESTER_TASK_FILTERS.map((f) => f.id));



function parseMyFilter(value: string | null): MyTaskFilter {

  if (value && VALID_MY_FILTERS.has(value as MyTaskFilter)) {

    return value as MyTaskFilter;

  }

  return 'in_progress';

}



function parseRequesterFilter(value: string | null): RequesterTaskFilter {

  if (value && VALID_REQUESTER_FILTERS.has(value as RequesterTaskFilter)) {

    return value as RequesterTaskFilter;

  }

  return 'active';

}



function parseGroupFilter(value: string | null): GroupTaskFilter {

  if (value && VALID_GROUP_FILTERS.has(value as GroupTaskFilter)) {

    return value as GroupTaskFilter;

  }

  return 'all';

}



function templateToForm(t: RequestTemplate): TaskCreateFormData {

  return {

    title: t.title,

    description: t.description || '',

    target_group_id: String(t.target_group_id),

    category_id: String(t.category_id),

    priority: t.priority,

    assignee_id: t.default_assignee_id ? String(t.default_assignee_id) : '',

    notify_before_minutes: '60',

  };

}



export function TasksPage() {

  const { user } = useAuth();

  const navigate = useNavigate();

  const requester = isRequestOnly(user?.role);

  const [searchParams, setSearchParams] = useSearchParams();

  const mode = window.location.pathname.split('/').pop() || 'my';

  const [tasks, setTasks] = useState<Task[]>([]);

  const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);

  const [createdTasks, setCreatedTasks] = useState<Task[]>([]);

  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(mode === 'new');

  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);

  const [categories, setCategories] = useState<{ id: number; name: string; group_id: number }[]>([]);

  const [users, setUsers] = useState<{ id: number; full_name: string; member_group_ids?: number[] }[]>([]);

  const [templates, setTemplates] = useState<RequestTemplate[]>([]);

  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

  const [form, setForm] = useState<TaskCreateFormData>(EMPTY_TASK_FORM);

  const [error, setError] = useState('');

  const [creating, setCreating] = useState(false);

  const filterParam = searchParams.get('filter');

  const templateParam = searchParams.get('template');

  const [myFilter, setMyFilter] = useState<MyTaskFilter>(() => parseMyFilter(filterParam));

  const [requesterFilter, setRequesterFilter] = useState<RequesterTaskFilter>(() => parseRequesterFilter(filterParam));

  const [groupFilter, setGroupFilter] = useState<GroupTaskFilter>(() => parseGroupFilter(filterParam));

  const isAdmin = user?.role === 'superadmin' || user?.role === 'group_admin';

  const titles = requester ? REQUESTER_TITLES : TITLES;

  const createLabel = requester ? 'Новая заявка' : 'Создать задачу';

  const emptyLabel = requester ? 'Нет заявок в этой категории' : 'Нет задач в этой категории';



  useEffect(() => {

    if (mode === 'my') {

      if (requester) {

        setRequesterFilter(parseRequesterFilter(filterParam));

      } else {

        setMyFilter(parseMyFilter(filterParam));

      }

    }

    if (mode === 'group') {

      setGroupFilter(parseGroupFilter(filterParam));

    }

  }, [mode, filterParam, requester]);



  const displayedTasks = useMemo(() => {

    if (mode === 'my' && requester) {

      return applyRequesterTaskFilter(createdTasks, requesterFilter);

    }

    if (mode === 'my') {

      return applyMyTaskFilter(assignedTasks, createdTasks, myFilter);

    }

    if (mode === 'group') {

      return applyGroupTaskFilter(tasks, groupFilter);

    }

    return sortByCreatedAt(tasks);

  }, [tasks, assignedTasks, createdTasks, mode, myFilter, requesterFilter, requester, groupFilter]);



  const load = () => {

    setLoading(true);

    if (mode === 'my') {

      if (requester) {

        listTasks({ created_by_me: true })

          .then(setCreatedTasks)

          .catch(() => {})

          .finally(() => setLoading(false));

        return;

      }

      Promise.all([

        listTasks({ my_tasks: true }),

        listTasks({ created_by_me: true }),

      ])

        .then(([assigned, created]) => {

          setAssignedTasks(assigned);

          setCreatedTasks(created);

        })

        .catch(() => {})

        .finally(() => setLoading(false));

      return;

    }

    const filters: Record<string, boolean | string> = {};

    if (mode === 'group') {

      filters.my_group = true;

      if (groupFilter === 'unassigned') filters.status = 'new';

      else if (groupFilter === 'done') filters.status = 'done';

    }

    if (mode === 'archive') {

      filters.archived = true;

    }

    listTasks(filters).then(setTasks).catch(() => {}).finally(() => setLoading(false));
    notifyTasksChanged();

  };



  useEffect(() => { load(); }, [mode, groupFilter, requester]);



  useEffect(() => {

    listGroups().then(setGroups).catch(() => {});

    listCategories().then(setCategories).catch(() => {});

    listRequestTemplates().then(setTemplates).catch(() => {});

    if (isAdmin) {

      listUsers().then(setUsers).catch(() => {});

    }

  }, [isAdmin]);



  useEffect(() => {

    if (!templateParam || templates.length === 0) return;

    const template = templates.find((t) => t.id === Number(templateParam));

    if (template) {

      setSelectedTemplateId(template.id);

      setForm(templateToForm(template));

    }

  }, [templateParam, templates]);



  const setMyFilterWithUrl = (filter: MyTaskFilter) => {

    setMyFilter(filter);

    setSearchParams(filter === 'in_progress' ? {} : { filter });

  };



  const setRequesterFilterWithUrl = (filter: RequesterTaskFilter) => {

    setRequesterFilter(filter);

    setSearchParams(filter === 'active' ? {} : { filter });

  };



  const setGroupFilterWithUrl = (filter: GroupTaskFilter) => {

    setGroupFilter(filter);

    setSearchParams(filter === 'all' ? {} : { filter });

  };



  const resetForm = () => {

    setForm(EMPTY_TASK_FORM);

    setSelectedTemplateId(null);

  };



  const applyTemplate = (template: RequestTemplate | null) => {

    setSelectedTemplateId(template?.id ?? null);

    setForm(template ? templateToForm(template) : EMPTY_TASK_FORM);

  };



  const handleCreate = async (e: React.FormEvent) => {

    e.preventDefault();

    if (creating) return;

    setError('');

    setCreating(true);

    try {

      const payload: Record<string, unknown> = {

        title: form.title,

        description: form.description || undefined,

        target_group_id: Number(form.target_group_id),

        category_id: Number(form.category_id),

        priority: form.priority,

        notify_before_minutes: Number(form.notify_before_minutes || 60),

      };

      if (isAdmin && form.assignee_id) {

        payload.assignee_id = Number(form.assignee_id);

      }

      const res = await createTask(payload);

      showToast(requester ? 'Заявка успешно создана' : 'Задача успешно создана', 'success');

      showAiNotice(res.ai_corrected);

      resetForm();

      if (mode === 'new') {

        navigate('/tasks/my');

        return;

      }

      setShowCreate(false);

      load();

      notifyTasksChanged();

    } catch (err) {

      setError(err instanceof Error ? err.message : 'Ошибка');

    } finally {

      setCreating(false);

    }

  };



  const isCreateDirty = () =>
    selectedTemplateId != null || isFormChanged(form, EMPTY_TASK_FORM);

  const leaveCreate = () => {
    setShowCreate(false);
    resetForm();
    setError('');
    if (mode === 'new') {
      navigate('/tasks/my');
    }
  };

  const closeCreate = async () => {
    if (!isCreateDirty()) {
      leaveCreate();
      return;
    }
    const decision = askSaveOrDiscard(
      requester
        ? 'Сохранить новую заявку перед выходом?'
        : 'Сохранить новую задачу перед выходом?',
    );
    if (decision === 'save') {
      if (!form.title.trim() || !form.target_group_id || !form.category_id) {
        setError('Заполните обязательные поля, чтобы сохранить заявку');
        return;
      }
      const fakeEvent = { preventDefault() {} } as React.FormEvent;
      await handleCreate(fakeEvent);
      return;
    }
    leaveCreate();
  };

  useEffect(() => {
    const dirty =
      (mode === 'new' || showCreate) &&
      (selectedTemplateId != null || isFormChanged(form, EMPTY_TASK_FORM));
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [mode, showCreate, form, selectedTemplateId]);



  const formProps = {

    form,

    setForm,

    groups,

    categories,

    users,

    showAssignee: isAdmin,

    error,

    submitting: creating,

    onSubmit: handleCreate,

    requesterMode: requester,

  };



  const createBlock = (

    <div className="card task-create-card">

      <RequestTemplatePicker

        templates={templates}

        selectedId={selectedTemplateId}

        onSelect={applyTemplate}

        requesterMode={requester}

      />

      <TaskCreateForm {...formProps} onCancel={() => void closeCreate()} />

    </div>

  );



  if (requester && mode === 'group') {

    return <Navigate to="/tasks/my" replace />;

  }

  if (mode === 'archive' && !isAdmin) {

    return <Navigate to="/tasks/my" replace />;

  }



  if (mode === 'new' || showCreate) {

    return (

      <div>

        <TasksSectionNav />

        <div className="page-header">
          <h1>{titles.new}</h1>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void closeCreate()}>
            ← Назад
          </button>
        </div>

        {createBlock}

      </div>

    );

  }



  return (

    <div>

      <TasksSectionNav />

      <div className="page-header">

        <h1>{titles[mode] || (requester ? 'Заявки' : 'Задачи')}</h1>

        {mode !== 'archive' && (mode === 'my' || mode === 'group' ? (

          <Link to="/tasks/new" className="btn btn-primary">{createLabel}</Link>

        ) : (

          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>{createLabel}</button>

        ))}

      </div>

      {mode === 'my' && requester && (

        <div className="quick-filters">

          {REQUESTER_TASK_FILTERS.map((f) => (

            <button

              key={f.id}

              type="button"

              className={`quick-filter-btn ${requesterFilter === f.id ? 'active' : ''}`}

              onClick={() => setRequesterFilterWithUrl(f.id)}

            >

              {f.label}

            </button>

          ))}

        </div>

      )}

      {mode === 'my' && !requester && (

        <div className="quick-filters">

          {MY_TASK_FILTERS.map((f) => (

            <button

              key={f.id}

              type="button"

              className={`quick-filter-btn ${myFilter === f.id ? 'active' : ''}`}

              onClick={() => setMyFilterWithUrl(f.id)}

            >

              {f.label}

            </button>

          ))}

        </div>

      )}

      {mode === 'group' && (

        <div className="quick-filters">

          {GROUP_FILTERS.map((f) => (

            <button

              key={f.id}

              type="button"

              className={`quick-filter-btn ${groupFilter === f.id ? 'active' : ''}`}

              onClick={() => setGroupFilterWithUrl(f.id)}

            >

              {f.label}

            </button>

          ))}

        </div>

      )}

      {loading ? (

        <p className="loading">Загрузка...</p>

      ) : displayedTasks.length === 0 ? (

        <p className="empty">{mode === 'archive' ? 'В архиве пока нет задач' : emptyLabel}</p>

      ) : (

        <TaskTable tasks={displayedTasks} />

      )}

      <Modal open={showCreate} onClose={() => void closeCreate()} title={titles.new}>

        <RequestTemplatePicker

          templates={templates}

          selectedId={selectedTemplateId}

          onSelect={applyTemplate}

          requesterMode={requester}

        />

        <TaskCreateForm {...formProps} onCancel={() => void closeCreate()} />

      </Modal>

    </div>

  );

}


