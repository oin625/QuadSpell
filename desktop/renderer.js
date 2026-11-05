'use strict';

const api = window.quadSpell;
const labels = {
  importantNotUrgent: '重要不紧急',
  importantUrgent: '重要且紧急',
  notImportantNotUrgent: '不紧急不重要',
  notImportantUrgent: '紧急不重要'
};
const statuses = {
  planned: '待开始',
  inProgress: '进行中',
  paused: '挂起',
  completed: '已完成'
};
const order = [
  'importantNotUrgent', 'importantUrgent',
  'notImportantNotUrgent', 'notImportantUrgent'
];
const fields = {
  title: document.getElementById('title'),
  project: document.getElementById('project'),
  notes: document.getElementById('notes'),
  quadrant: document.getElementById('quadrant'),
  status: document.getElementById('demand-status'),
  hasDue: document.getElementById('has-due'),
  due: document.getElementById('due'),
  codeEntry: document.getElementById('code-entry'),
  materials: document.getElementById('materials'),
  intent: document.getElementById('intent'),
  supplement: document.getElementById('supplement'),
  progress: document.getElementById('new-progress')
};
const state = {
  demands: [],
  search: '',
  status: 'active',
  layout: localStorage.getItem('quadspell-layout') === 'list' ? 'list' : 'matrix',
  editing: null,
  initialForm: null
};
const board = document.getElementById('board');
const dialog = document.getElementById('editor');
const message = document.getElementById('message');
const editorError = document.getElementById('editor-error');

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = String(text);
  return node;
}

function showMessage(text, error = false) {
  message.hidden = !text;
  message.textContent = text || '';
  message.classList.toggle('error', error);
}

function showEditorError(text) {
  editorError.hidden = !text;
  editorError.textContent = text || '';
}

function visibleDemands() {
  const query = state.search.trim().toLocaleLowerCase();
  return state.demands.filter(demand => {
    const statusMatches = state.status === 'all' ||
      (state.status === 'active' ? demand.status !== 'completed' : demand.status === state.status);
    const textMatches = !query || [
      demand.title, demand.project, demand.notes,
      demand.spell.codeEntry, demand.spell.materials,
      demand.spell.intent, demand.spell.supplement
    ].some(value => value.toLocaleLowerCase().includes(query));
    return statusMatches && textMatches;
  }).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

function dateInputValue(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const part = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}`;
}

function dateFromInput(value) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function formatDate(iso, withTime = false) {
  return new Date(iso).toLocaleString('zh-CN', withTime
    ? { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: 'numeric', day: 'numeric' });
}

function renderCard(demand) {
  const card = element('article', 'card');
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `编辑需求：${demand.title}`);
  card.draggable = true;
  card.addEventListener('click', () => openEditor(demand));
  card.addEventListener('keydown', event => {
    if (event.target === card && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      openEditor(demand);
    }
  });
  card.addEventListener('dragstart', event => {
    event.dataTransfer.setData('text/plain', `quadspell:${demand.id}`);
    event.dataTransfer.effectAllowed = 'move';
    card.classList.add('dragging');
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));

  const content = element('div', 'card-content');
  const top = element('div', 'card-top');
  top.append(element('span', 'card-title', demand.title),
             element('span', 'card-status', statuses[demand.status]));
  content.append(top);
  if (demand.project) content.append(element('div', 'card-meta', demand.project));
  if (demand.dueDate) {
    content.append(element('div', 'card-meta', `截止：${formatDate(demand.dueDate)}`));
  }
  if (demand.progress.length) {
    content.append(element('div', 'card-progress', demand.progress.at(-1).text));
  }
  card.append(content);
  if (demand.spell.intent.trim()) {
    const copy = element('button', 'copy-button', '✦');
    copy.type = 'button';
    copy.title = '复制咒言';
    copy.setAttribute('aria-label', `复制咒言：${demand.title}`);
    copy.addEventListener('click', async event => {
      event.stopPropagation();
      try {
        const result = await api.copySpell(demand.id);
        showMessage(result.ok ? '咒言已复制到剪贴板' : result.error, !result.ok);
      } catch (error) {
        showMessage(`复制失败：${error.message}`, true);
      }
    });
    card.append(copy);
  }
  return card;
}

function renderMatrix(demands) {
  const axes = element('div', 'axes');
  axes.append(element('span', '', '重要程度 ↑'), element('span', '', '紧急程度 →'));
  const matrix = element('div', 'matrix');
  for (const quadrant of order) {
    const items = demands.filter(demand => demand.quadrant === quadrant);
    const panel = element('section', `quadrant q-${quadrant}`);
    panel.setAttribute('aria-label', `${labels[quadrant]}，${items.length} 项`);
    const heading = element('div', 'quadrant-header');
    heading.append(element('span', 'dot'),
                   element('span', '', labels[quadrant]),
                   element('span', 'number', items.length));
    panel.append(heading);
    const body = element('div', 'quadrant-body');
    if (items.length === 0) {
      body.append(element('p', 'empty', '拖入需求，或在编辑时选择此象限'));
    } else {
      items.forEach(demand => body.append(renderCard(demand)));
    }
    panel.append(body);
    panel.addEventListener('dragover', event => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      panel.classList.add('drag-over');
    });
    panel.addEventListener('dragleave', event => {
      if (!panel.contains(event.relatedTarget)) panel.classList.remove('drag-over');
    });
    panel.addEventListener('drop', async event => {
      event.preventDefault();
      panel.classList.remove('drag-over');
      const value = event.dataTransfer.getData('text/plain');
      if (!value.startsWith('quadspell:')) return;
      const id = value.slice('quadspell:'.length);
      try {
        const result = await api.move(id, quadrant);
        applyResult(result);
      } catch (error) {
        showMessage(`移动失败：${error.message}`, true);
      }
    });
    matrix.append(panel);
  }
  board.replaceChildren(axes, matrix);
}

function renderList(demands) {
  if (demands.length === 0) {
    const empty = element('div', 'board-empty');
    empty.append(element('strong', '', '暂无需求'),
                 element('span', '', '点击“新增需求”开始整理你的想法。'));
    board.replaceChildren(empty);
    return;
  }
  const list = element('div', 'list');
  demands.forEach(demand => list.append(renderCard(demand)));
  board.replaceChildren(list);
}

function render() {
  const demands = visibleDemands();
  document.getElementById('count').textContent = `${demands.length} 项`;
  document.getElementById('matrix-tab').setAttribute('aria-pressed', state.layout === 'matrix');
  document.getElementById('list-tab').setAttribute('aria-pressed', state.layout === 'list');
  if (state.layout === 'matrix') renderMatrix(demands);
  else renderList(demands);
}

function applyResult(result) {
  if (!result.ok) {
    showMessage(result.error || '操作失败', true);
    return false;
  }
  state.demands = result.demands;
  showMessage('');
  render();
  return true;
}

function formValues() {
  return {
    title: fields.title.value,
    project: fields.project.value,
    notes: fields.notes.value,
    quadrant: fields.quadrant.value,
    status: fields.status.value,
    hasDue: fields.hasDue.checked,
    due: fields.due.value,
    codeEntry: fields.codeEntry.value,
    materials: fields.materials.value,
    intent: fields.intent.value,
    supplement: fields.supplement.value,
    progress: fields.progress.value
  };
}

function renderProgress(demand) {
  const history = document.getElementById('progress-history');
  history.replaceChildren();
  for (const entry of [...demand.progress].reverse()) {
    const row = element('div', 'progress-entry');
    const time = element('time', '', formatDate(entry.createdAt, true));
    time.dateTime = entry.createdAt;
    row.append(time, element('div', '', entry.text));
    history.append(row);
  }
}

function openEditor(demand) {
  state.editing = structuredClone(demand);
  document.getElementById('editor-title').textContent =
    state.demands.some(item => item.id === demand.id) ? '编辑需求' : '新增需求';
  document.getElementById('delete').hidden =
    !state.demands.some(item => item.id === demand.id);
  fields.title.value = demand.title;
  fields.project.value = demand.project;
  fields.notes.value = demand.notes;
  fields.quadrant.value = demand.quadrant;
  fields.status.value = demand.status;
  fields.hasDue.checked = !!demand.dueDate;
  fields.due.value = dateInputValue(demand.dueDate);
  document.getElementById('due-wrap').hidden = !fields.hasDue.checked;
  fields.codeEntry.value = demand.spell.codeEntry;
  fields.materials.value = demand.spell.materials;
  fields.intent.value = demand.spell.intent;
  fields.supplement.value = demand.spell.supplement;
  fields.progress.value = '';
  renderProgress(demand);
  showEditorError('');
  state.initialForm = JSON.stringify(formValues());
  dialog.showModal();
  fields.title.focus();
}

function requestClose() {
  if (JSON.stringify(formValues()) !== state.initialForm &&
      !window.confirm('放弃未保存的修改？')) return;
  dialog.close();
  state.editing = null;
}

async function save(copy) {
  if (!state.editing) return;
  const values = formValues();
  if (!values.title.trim()) {
    showEditorError('请填写需求标题');
    fields.title.focus();
    return;
  }
  const spell = {
    codeEntry: values.codeEntry,
    materials: values.materials,
    intent: values.intent,
    supplement: values.supplement
  };
  if (Object.values(spell).some(value => value.trim()) && !spell.intent.trim()) {
    showEditorError('填写咒言时，请写明“要做什么”');
    fields.intent.focus();
    return;
  }
  if (copy && !spell.intent.trim()) {
    showEditorError('请先填写咒言，再使用“保存并复制”');
    fields.intent.focus();
    return;
  }
  const demand = {
    ...state.editing,
    title: values.title,
    project: values.project,
    notes: values.notes,
    quadrant: values.quadrant,
    status: values.status,
    dueDate: values.hasDue ? dateFromInput(values.due) : null,
    spell
  };
  try {
    const result = await api.save(demand, values.progress);
    if (!result.ok) {
      showEditorError(result.error);
      return;
    }
    applyResult(result);
    dialog.close();
    state.editing = null;
    if (copy) {
      const copied = await api.copySpell(demand.id);
      showMessage(copied.ok ? '咒言已保存并复制到剪贴板' : copied.error, !copied.ok);
    }
  } catch (error) {
    showEditorError(`保存失败：${error.message}`);
  }
}

async function remove() {
  if (!state.editing || !window.confirm('删除这条需求？此操作会移除本机记录。')) return;
  try {
    const result = await api.remove(state.editing.id);
    if (applyResult(result)) {
      dialog.close();
      state.editing = null;
    } else {
      showEditorError(result.error);
    }
  } catch (error) {
    showEditorError(`删除失败：${error.message}`);
  }
}

document.getElementById('add').addEventListener('click', async () => {
  try { openEditor(await api.newDemand()); }
  catch (error) { showMessage(`新建失败：${error.message}`, true); }
});
document.getElementById('search').addEventListener('input', event => {
  state.search = event.target.value;
  render();
});
document.getElementById('status').addEventListener('change', event => {
  state.status = event.target.value;
  render();
});
for (const layout of ['matrix', 'list']) {
  document.getElementById(`${layout}-tab`).addEventListener('click', () => {
    state.layout = layout;
    localStorage.setItem('quadspell-layout', layout);
    render();
  });
}
fields.hasDue.addEventListener('change', () => {
  document.getElementById('due-wrap').hidden = !fields.hasDue.checked;
  if (fields.hasDue.checked && !fields.due.value) fields.due.value = dateInputValue(new Date());
});
document.getElementById('cancel').addEventListener('click', requestClose);
document.getElementById('save').addEventListener('click', () => save(false));
document.getElementById('save-copy').addEventListener('click', () => save(true));
document.getElementById('delete').addEventListener('click', remove);
dialog.addEventListener('cancel', event => {
  event.preventDefault();
  requestClose();
});
document.addEventListener('keydown', event => {
  if (!dialog.open && event.ctrlKey && event.key.toLowerCase() === 'n') {
    event.preventDefault();
    document.getElementById('add').click();
  }
  if (dialog.open && event.ctrlKey && event.key.toLowerCase() === 's') {
    event.preventDefault();
    save(false);
  }
});

api.load().then(snapshot => {
  state.demands = snapshot.demands;
  if (snapshot.error) showMessage(snapshot.error, true);
  render();
}).catch(error => {
  showMessage(`读取失败：${error.message}`, true);
});
