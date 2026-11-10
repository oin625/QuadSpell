'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { newDemand, parseBoard, buildPrompt, matches } = require('../model.cjs');
const { DemandStorage } = require('../storage.cjs');
const { DraftStorage } = require('../drafts.cjs');

function temporary(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'quadspell-handoff-'));
  try { run(directory); } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

test('shared v2 fixture carries summary, changes, and later progress without duplicating history', () => {
  const text = fs.readFileSync(path.join(__dirname, '../../Tests/Fixtures/handoff-board.json'), 'utf8');
  const demand = parseBoard(text).demands[0];
  const prompt = buildPrompt(demand);
  assert.match(prompt, /### 下一步\n验证相同时间排序/);
  assert.match(prompt, /C001/);
  assert.match(prompt, /相同时间保持输入顺序/);
  assert.match(prompt, /相同时间排序仍待验证/);
  assert.doesNotMatch(prompt, /完成排序实现/);
  assert.equal(matches(demand, '回归尚未执行'), true);
});

test('v1 is read without rewriting and upgrades with complete history on save', () => temporary(directory => {
  const file = path.join(directory, 'demands.json');
  const text = fs.readFileSync(path.join(__dirname, '../../Tests/Fixtures/mac-board.json'), 'utf8');
  fs.writeFileSync(file, text);
  const store = new DemandStorage(file);
  assert.equal(fs.readFileSync(file, 'utf8'), text);
  const original = store.demands[0];
  assert.equal(original.handoff.pending, '');
  assert.equal(store.upsert(original, '', original, '稳定排序').ok, true);
  const reopened = new DemandStorage(file);
  assert.equal(reopened.demands[0].progress.length, 1);
  assert.equal(reopened.demands[0].changes[0].text, '稳定排序');
  assert.equal(parseBoard(fs.readFileSync(file, 'utf8')).schemaVersion, 2);
}));

test('summary covers current progress, later progress is copied, and clearing restores full history', () => temporary(directory => {
  const store = new DemandStorage(path.join(directory, 'demands.json'));
  const demand = newDemand();
  demand.title = '接续';
  demand.spell.intent = '完成任务';
  assert.equal(store.upsert(demand, '实现完成').ok, true);
  const original = structuredClone(store.demands[0]);
  const updated = structuredClone(original);
  updated.handoff.completed = '实现完成';
  updated.handoff.pending = '完成回归';
  updated.handoff.verification = '尚未执行';
  assert.equal(store.upsert(updated, '边界处理完成', original, '保留旧 API').ok, true);
  const summarized = structuredClone(store.demands[0]);
  assert.equal(summarized.handoff.coveredProgressCount, 2);
  assert.equal(store.upsert(summarized, '回归失败', summarized).ok, true);
  const latest = structuredClone(store.demands[0]);
  assert.equal(latest.progress.length, 3);
  assert.equal(latest.changes.length, 1);
  assert.match(buildPrompt(latest), /回归失败/);
  assert.doesNotMatch(buildPrompt(latest), /边界处理完成/);
  const cleared = structuredClone(latest);
  cleared.handoff = newDemand().handoff;
  assert.equal(store.upsert(cleared, '', latest).ok, true);
  assert.match(buildPrompt(store.demands[0]), /边界处理完成/);
}));

test('partial summary retains unfinished verification from history', () => temporary(directory => {
  const store = new DemandStorage(path.join(directory, 'demands.json'));
  const demand = newDemand();
  demand.title = '待验证';
  demand.handoff.completed = '实现完成';
  assert.equal(store.upsert(demand, '回归尚未执行').ok, true);
  assert.equal(store.demands[0].handoff.coveredProgressCount, 0);
  assert.match(buildPrompt(store.demands[0]), /回归尚未执行/);
}));

test('stale editor cannot replace or delete newer task', () => temporary(directory => {
  const store = new DemandStorage(path.join(directory, 'demands.json'));
  const demand = newDemand();
  demand.title = '原任务';
  assert.equal(store.upsert(demand).ok, true);
  const original = structuredClone(store.demands[0]);
  const updated = { ...original, notes: '另一编辑器的修改' };
  assert.equal(store.upsert(updated, '', original).ok, true);
  assert.equal(store.upsert(original, '', original).ok, false);
  assert.equal(store.remove(original.id, original).ok, false);
  assert.equal(store.demands[0].notes, updated.notes);
}));

test('external file modification is preserved and refreshed before retry', () => temporary(directory => {
  const file = path.join(directory, 'demands.json');
  const first = new DemandStorage(file);
  const demand = newDemand();
  demand.title = '原任务';
  assert.equal(first.upsert(demand).ok, true);
  const original = structuredClone(first.demands[0]);
  const second = new DemandStorage(file);
  assert.equal(second.upsert({ ...original, title: '外部更新' }, '', original).ok, true);
  const bytes = fs.readFileSync(file, 'utf8');
  assert.equal(first.upsert(original, '', original).ok, false);
  assert.equal(fs.readFileSync(file, 'utf8'), bytes);
  assert.equal(first.demands[0].title, '外部更新');
}));

test('incomplete drafts survive restart with pending progress and changes', () => temporary(directory => {
  const file = path.join(directory, 'drafts.json');
  const demand = newDemand();
  demand.spell.codeEntry = '未写完的入口';
  const draft = { demand, expected: null, progressText: '进展草稿', changeText: '变更草稿' };
  assert.equal(new DraftStorage(file).save(draft).ok, true);
  const reopened = new DraftStorage(file);
  assert.equal(reopened.drafts.new.demand.spell.codeEntry, demand.spell.codeEntry);
  assert.equal(reopened.drafts.new.progressText, draft.progressText);
  assert.equal(reopened.drafts.new.changeText, draft.changeText);
  assert.equal(reopened.remove('new').ok, true);
  assert.deepEqual(new DraftStorage(file).drafts, {});
}));

test('corrupt drafts and future board formats block writes without data loss', () => temporary(directory => {
  const draftFile = path.join(directory, 'drafts.json');
  fs.writeFileSync(draftFile, '{broken');
  const drafts = new DraftStorage(draftFile);
  assert.equal(drafts.save({ demand: newDemand(), expected: null, progressText: '', changeText: '' }).ok, false);
  assert.equal(fs.readFileSync(draftFile, 'utf8'), '{broken');
  const file = path.join(directory, 'demands.json');
  const future = '{"schemaVersion":3,"demands":[]}';
  fs.writeFileSync(file, future);
  const demand = newDemand();
  demand.title = '不可覆盖';
  assert.equal(new DemandStorage(file).upsert(demand).ok, false);
  assert.equal(fs.readFileSync(file, 'utf8'), future);
}));

test('draft conflict stays blocked until explicit reload', () => temporary(directory => {
  const file = path.join(directory, 'drafts.json');
  const first = new DraftStorage(file);
  const second = new DraftStorage(file);
  const demand = newDemand();
  demand.notes = '另一个窗口';
  const draft = { demand, expected: null, progressText: '', changeText: '' };
  assert.equal(second.save(draft).ok, true);
  const bytes = fs.readFileSync(file, 'utf8');
  const stale = { ...draft, demand: newDemand() };
  assert.equal(first.save(stale).ok, false);
  assert.equal(first.save(stale).ok, false);
  assert.equal(fs.readFileSync(file, 'utf8'), bytes);
  first.load();
  assert.equal(first.drafts.new.demand.notes, demand.notes);
}));

test('invalid coverage and duplicated changes are rejected', () => {
  const demand = newDemand();
  demand.title = '坏数据';
  demand.handoff.coveredProgressCount = 1;
  assert.throws(() => parseBoard(JSON.stringify({ schemaVersion: 2, demands: [demand] })), /交接摘要/);
  demand.handoff.coveredProgressCount = 0;
  const change = { id: demand.id, createdAt: demand.createdAt, text: '重复变更' };
  demand.changes = [change, change];
  assert.throws(() => parseBoard(JSON.stringify({ schemaVersion: 2, demands: [demand] })), /变更/);
});
