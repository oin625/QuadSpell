'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { newDemand, parseBoard, buildPrompt, timestamp } = require('../model.cjs');
const { DemandStorage } = require('../storage.cjs');

test('Windows reads native macOS JSON without changing its schema', () => {
  const fixture = fs.readFileSync(path.join(__dirname, '../../Tests/Fixtures/mac-board.json'), 'utf8');
  const board = parseBoard(fixture);
  assert.equal(board.demands[0].title, '示例需求');
  assert.equal(board.demands[0].spell.intent, '让搜索结果按时间排序。');
  assert.equal(board.demands[0].progress[0].text, '已完成数据结构设计');
});

test('new demand and prompt contain the same core fields as macOS', () => {
  const demand = newDemand();
  demand.title = '跨平台搜索';
  demand.project = '示例项目';
  demand.spell.codeEntry = '搜索模块';
  demand.spell.intent = '输入后展示匹配结果';
  demand.progress.push({
    id: 'cf46d45a-163a-4a7e-815b-fbd25bbb4041',
    createdAt: timestamp(),
    text: '完成原型'
  });
  const prompt = buildPrompt(demand);
  assert.match(prompt, /## 代码入口\n搜索模块/);
  assert.match(prompt, /## 要做什么\n输入后展示匹配结果/);
  assert.match(prompt, /## 已记录的进度/);
});

test('storage persists edits, moves and progress as portable JSON', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'quadspell-'));
  try {
    const file = path.join(directory, 'demands.json');
    const storage = new DemandStorage(file);
    const demand = newDemand();
    demand.title = '测试需求';
    demand.spell.intent = '完成目标';
    assert.equal(storage.upsert(demand, '第一条进度').ok, true);
    assert.equal(storage.move(demand.id, 'importantUrgent').ok, true);
    const reopened = new DemandStorage(file);
    assert.equal(reopened.demands[0].quadrant, 'importantUrgent');
    assert.equal(reopened.demands[0].progress[0].text, '第一条进度');
    assert.equal(reopened.demands[0].progress.length, 1);
    assert.equal(parseBoard(fs.readFileSync(file, 'utf8')).schemaVersion, 2);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('invalid existing data is retained and blocks writes', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'quadspell-'));
  try {
    const file = path.join(directory, 'demands.json');
    fs.writeFileSync(file, '{broken');
    const storage = new DemandStorage(file);
    const demand = newDemand();
    demand.title = '不应写入';
    assert.equal(storage.upsert(demand).ok, false);
    assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('incomplete spell is rejected before writing', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'quadspell-'));
  try {
    const file = path.join(directory, 'demands.json');
    const storage = new DemandStorage(file);
    const demand = newDemand();
    demand.title = '测试';
    demand.spell.codeEntry = '某个代码路径';
    assert.match(storage.upsert(demand).error, /要做什么/);
    assert.equal(fs.existsSync(file), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
