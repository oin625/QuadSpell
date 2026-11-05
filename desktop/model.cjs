'use strict';

const crypto = require('node:crypto');

const quadrants = [
  'importantNotUrgent',
  'importantUrgent',
  'notImportantNotUrgent',
  'notImportantUrgent'
];
const statuses = ['planned', 'inProgress', 'paused', 'completed'];

function timestamp(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function newDemand() {
  const now = timestamp();
  return {
    id: crypto.randomUUID(),
    title: '',
    project: '',
    notes: '',
    quadrant: 'importantNotUrgent',
    status: 'planned',
    dueDate: null,
    spell: { codeEntry: '', materials: '', intent: '', supplement: '' },
    progress: [],
    createdAt: now,
    updatedAt: now
  };
}

function validateDemand(input) {
  if (!input || typeof input !== 'object') throw new Error('需求数据无效');
  if (typeof input.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.id)) {
    throw new Error('需求 ID 无效');
  }
  if (typeof input.title !== 'string' || !input.title.trim()) throw new Error('请填写需求标题');
  if (!quadrants.includes(input.quadrant)) throw new Error('四象限分类无效');
  if (!statuses.includes(input.status)) throw new Error('需求状态无效');
  const spell = input.spell;
  if (!spell || typeof spell !== 'object') throw new Error('咒言数据无效');
  for (const key of ['codeEntry', 'materials', 'intent', 'supplement']) {
    if (typeof spell[key] !== 'string') throw new Error('咒言字段无效');
  }
  const hasSpell = Object.values(spell).some(value => value.trim());
  if (hasSpell && !spell.intent.trim()) throw new Error('填写咒言时，请写明“要做什么”');
  if (!Array.isArray(input.progress)) throw new Error('进度记录无效');
  for (const entry of input.progress) {
    if (!entry || typeof entry.id !== 'string' ||
        typeof entry.text !== 'string' || !validDate(entry.createdAt)) {
      throw new Error('进度记录无效');
    }
  }
  for (const key of ['createdAt', 'updatedAt']) {
    if (!validDate(input[key])) throw new Error('需求日期无效');
  }
  if (input.dueDate != null && !validDate(input.dueDate)) throw new Error('截止日期无效');
  for (const key of ['project', 'notes']) {
    if (typeof input[key] !== 'string') throw new Error('需求字段无效');
  }
}

function validDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function normalizeDemand(input, existing = null) {
  validateDemand(input);
  const now = timestamp();
  return {
    id: input.id,
    title: input.title.trim(),
    project: input.project.trim(),
    notes: input.notes,
    quadrant: input.quadrant,
    status: input.status,
    dueDate: input.dueDate,
    spell: {
      codeEntry: input.spell.codeEntry,
      materials: input.spell.materials,
      intent: input.spell.intent,
      supplement: input.spell.supplement
    },
    progress: input.progress.map(entry => ({
      id: entry.id,
      createdAt: entry.createdAt,
      text: entry.text
    })),
    createdAt: existing ? existing.createdAt : input.createdAt,
    updatedAt: now
  };
}

function parseBoard(text) {
  const board = JSON.parse(text);
  if (!board || board.schemaVersion !== 1 || !Array.isArray(board.demands)) {
    throw new Error('不支持的需求数据版本');
  }
  const ids = new Set();
  for (const demand of board.demands) {
    validateDemand(demand);
    if (ids.has(demand.id)) throw new Error('发现重复的需求 ID');
    ids.add(demand.id);
  }
  return board;
}

function matches(demand, query) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return [
    demand.title, demand.project, demand.notes,
    demand.spell.codeEntry, demand.spell.materials,
    demand.spell.intent, demand.spell.supplement
  ].some(value => value.toLocaleLowerCase().includes(needle));
}

function buildPrompt(demand) {
  const parts = [`# 需求：${demand.title}`];
  if (demand.project) parts.push(`项目：${demand.project}`);
  if (demand.notes) parts.push(`背景与备注：\n${demand.notes}`);
  if (demand.spell.codeEntry) {
    parts.push(`## 代码入口\n${demand.spell.codeEntry}\n请先定位并阅读相关实现。`);
  }
  if (demand.spell.materials) {
    parts.push(`## 可能有用的资料\n${demand.spell.materials}\n请按需查找并阅读。`);
  }
  if (demand.spell.intent) parts.push(`## 要做什么\n${demand.spell.intent}`);
  if (demand.spell.supplement) parts.push(`## 补充说明\n${demand.spell.supplement}`);
  if (demand.progress.length) {
    const history = demand.progress.map(entry =>
      `- ${new Date(entry.createdAt).toLocaleString('zh-CN')}：${entry.text}`
    ).join('\n');
    parts.push(`## 已记录的进度\n${history}`);
  }
  return parts.join('\n\n');
}

module.exports = {
  quadrants, statuses, timestamp, newDemand, validateDemand,
  normalizeDemand, parseBoard, matches, buildPrompt
};
