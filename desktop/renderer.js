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
  progress: document.getElementById('new-progress'),
  change: document.getElementById('new-change'),
  completed: document.getElementById('handoff-completed'),
  pending: document.getElementById('handoff-pending'),
  decisions: document.getElementById('handoff-decisions'),
  verification: document.getElementById('handoff-verification')
};
const state = {
  demands: [],
  search: '',
  status: 'active',
  layout: localStorage.getItem('quadspell-layout') === 'list' ? 'list' : 'matrix',
  editing: null,
  initialForm: null,
  expected: null,
  draftKey: null,
  drafts: {},
  saving: false
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
      demand.spell.intent, demand.spell.supplement,
      ...Object.values(demand.handoff ?? {}).filter(value => typeof value === 'string'),
      ...(demand.changes ?? []).map(entry => entry.text), ...demand.progress.map(entry => entry.text)
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
    progress: fields.progress.value,
    change: fields.change.value,
    completed: fields.completed.value,
    pending: fields.pending.value,
    decisions: fields.decisions.value,
    verification: fields.verification.value
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

function renderDraftPicker() {
  const picker = document.getElementById('draft-picker');
  picker.replaceChildren();
  const entries = Object.entries(state.drafts);
  picker.hidden = !entries.length;
  picker.append(element('option', '', '恢复草稿（' + entries.length + '）'));
  picker.firstChild.value = '';
  for (const [key, draft] of entries) {
    const option = element('option', '', draft.demand.title || '未命名需求');
    option.value = key;
    picker.append(option);
  }
}

function editingDemand() {
  const values = formValues();
  return {
    ...state.editing,
    title: values.title, project: values.project, notes: values.notes,
    quadrant: values.quadrant, status: values.status,
    dueDate: values.hasDue ? dateFromInput(values.due) : null,
    spell: { codeEntry: values.codeEntry, materials: values.materials,
      intent: values.intent, supplement: values.supplement },
    handoff: { ...state.editing.handoff, completed: values.completed,
      pending: values.pending, decisions: values.decisions, verification: values.verification }
  };
}

function preserveDraft() {
  if (!state.editing || state.saving) return true;
  try {
    const result = JSON.stringify(formValues()) === state.initialForm
      ? api.removeDraft(state.draftKey)
      : api.saveDraft({ demand: editingDemand(), expected: state.expected,
        progressText: fields.progress.value, changeText: fields.change.value });
    if (!result.ok) {
      showEditorError(result.error);
      document.getElementById('draft-status').textContent = '草稿未保存，请保持窗口打开或先复制备份。';
      return false;
    }
    state.drafts = result.drafts;
    renderDraftPicker();
    document.getElementById('draft-status').textContent = '草稿已保存在本机。关闭或重启后可恢复；保存后正式生效。';
    return true;
  } catch (error) {
    showEditorError('草稿保存失败：' + error.message);
    return false;
  }
}

function renderChanges(demand) {
  const history = document.getElementById('change-history');
  history.replaceChildren();
  (demand.changes ?? []).forEach((entry, index) => {
    const row = element('details', 'progress-entry');
    row.append(element('summary', '', 'C' + String(index + 1).padStart(3, '0') +
      ' · ' + formatDate(entry.createdAt, true)), element('div', '', entry.text));
    history.append(row);
  });
}

async function openEditor(demand) {
  if (dialog.open) return;
  try {
    const [snapshot, draftSnapshot] = await Promise.all([api.load(), api.listDrafts()]);
    if (dialog.open) return;
    state.demands = snapshot.demands;
    state.drafts = draftSnapshot.drafts;
    render();
    renderDraftPicker();
    const current = state.demands.find(item => item.id === demand.id) ?? null;
    const matchingKey = Object.keys(state.drafts).find(key => state.drafts[key].demand.id === demand.id);
    state.draftKey = matchingKey ?? (current ? demand.id.toUpperCase() : 'new');
    const saved = state.drafts[state.draftKey];
    state.expected = saved ? saved.expected ?? null : current;
    const baseline = current ?? demand;
    state.editing = structuredClone(baseline);
    fillEditor(baseline);
    state.initialForm = JSON.stringify(formValues());
    if (saved) {
      state.editing = structuredClone(saved.demand);
      fillEditor(saved.demand, saved.progressText, saved.changeText);
    }
    document.getElementById('editor-title').textContent = current ? '编辑需求' : '新增需求';
    document.getElementById('delete').hidden = !current;
    document.getElementById('draft-status').textContent = saved
      ? '已恢复本机草稿。保存后生效，关闭会继续保留。'
      : '输入自动保存在本机，关闭后可恢复。';
    showEditorError(draftSnapshot.error || snapshot.error || '');
    dialog.showModal();
    fields.title.focus();
  } catch (error) {
    showMessage('打开需求失败：' + error.message, true);
  }
}

function fillEditor(demand, progress = '', change = '') {
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
  fields.progress.value = progress;
  fields.change.value = change;
  const handoff = demand.handoff ?? {};
  for (const key of ['completed', 'pending', 'decisions', 'verification']) fields[key].value = handoff[key] ?? '';
  renderProgress(demand);
  renderChanges(demand);
}

function requestClose() {
  if (state.saving || !preserveDraft()) return;
  dialog.close();
  state.editing = null;
}

function discardDraft() {
  if (state.saving || !window.confirm('放弃这份未保存的草稿？已保存的需求和记录会保留。')) return;
  const result = api.removeDraft(state.draftKey);
  if (!result.ok) { showEditorError(result.error); return; }
  state.drafts = result.drafts;
  renderDraftPicker();
  dialog.close();
  state.editing = null;
}

async function save(copy) {
  if (!state.editing || state.saving) return;
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
  const demand = editingDemand();
  if (!preserveDraft()) return;
  state.saving = true;
  document.getElementById('save').disabled = true;
  document.getElementById('save-copy').disabled = true;
  try {
    const result = await api.save(demand, values.progress, state.expected, values.change);
    if (!result.ok) {
      showEditorError(result.error);
      return;
    }
    applyResult(result);
    const cleared = api.removeDraft(state.draftKey);
    if (cleared.ok) { state.drafts = cleared.drafts; renderDraftPicker(); }
    else showMessage('需求已保存，但草稿清理失败：' + cleared.error, true);
    dialog.close();
    state.editing = null;
    if (copy) {
      const copied = await api.copySpell(demand.id);
      showMessage(copied.ok ? '咒言已保存并复制到剪贴板' : copied.error, !copied.ok);
    }
  } catch (error) {
    showEditorError(`保存失败：${error.message}`);
  } finally {
    state.saving = false;
    document.getElementById('save').disabled = false;
    document.getElementById('save-copy').disabled = false;
  }
}

async function remove() {
  if (!state.editing || state.saving || !window.confirm('删除这条需求？此操作会移除本机记录。')) return;
  try {
    const result = await api.remove(state.editing.id, state.expected);
    if (applyResult(result)) {
      const cleared = api.removeDraft(state.draftKey);
      if (cleared.ok) { state.drafts = cleared.drafts; renderDraftPicker(); }
      else showMessage(cleared.error, true);
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
document.getElementById('discard').addEventListener('click', discardDraft);
document.getElementById('draft-picker').addEventListener('change', event => {
  const saved = state.drafts[event.target.value];
  if (saved) openEditor(saved.demand);
});
for (const field of Object.values(fields)) {
  field.addEventListener('input', preserveDraft);
  field.addEventListener('change', preserveDraft);
}
window.addEventListener('beforeunload', event => {
  if (state.saving || !preserveDraft()) { event.preventDefault(); event.returnValue = ''; }
});
document.getElementById('save').addEventListener('click', () => save(false));
document.getElementById('save-copy').addEventListener('click', () => save(true));
document.getElementById('delete').addEventListener('click', remove);
dialog.addEventListener('cancel', event => {
  event.preventDefault();
  requestClose();
});
document.addEventListener('keydown', event => {
  if (!dialog.open && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
    event.preventDefault();
    document.getElementById('add').click();
  }
  if (dialog.open && (event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    save(true);
  }
  if (dialog.open && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    save(false);
  }
});

Promise.all([api.load(), api.listDrafts()]).then(([snapshot, draftSnapshot]) => {
  state.drafts = draftSnapshot.drafts;
  renderDraftPicker();
  if (draftSnapshot.error) showMessage(draftSnapshot.error, true);
  state.demands = snapshot.demands;
  if (snapshot.error) showMessage(snapshot.error, true);
  render();
}).catch(error => {
  showMessage(`读取失败：${error.message}`, true);
});
