'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { validateDemand } = require('./model.cjs');

function draftKey(draft) {
  return draft.expected == null ? 'new' : draft.demand.id.toUpperCase();
}

function validateDraft(draft) {
  if (!draft || typeof draft !== 'object') throw new Error('草稿无效');
  validateDemand(draft.demand, { allowIncomplete: true });
  if (draft.expected != null) {
    validateDemand(draft.expected);
    if (draft.expected.id !== draft.demand.id) throw new Error('草稿编号不匹配');
  }
  if (typeof draft.progressText !== 'string' || typeof draft.changeText !== 'string') {
    throw new Error('草稿内容无效');
  }
}

class DraftStorage {
  constructor(filePath) {
    this.filePath = filePath;
    this.drafts = {};
    this.error = null;
    this.loadedText = null;
    this.load();
  }

  load() {
    try {
      if (!fs.existsSync(this.filePath)) {
        this.drafts = {};
        this.loadedText = null;
        this.error = null;
        return;
      }
      const text = fs.readFileSync(this.filePath, 'utf8');
      const file = JSON.parse(text);
      if (file.schemaVersion !== 1 || !file.drafts || typeof file.drafts !== 'object' ||
          Array.isArray(file.drafts)) throw new Error('草稿格式不受支持');
      for (const [key, draft] of Object.entries(file.drafts)) {
        validateDraft(draft);
        if (draftKey(draft) !== key) throw new Error('草稿编号无效');
      }
      this.drafts = file.drafts;
      this.loadedText = text;
      this.error = null;
    } catch (error) {
      this.error = '草稿无法读取，原文件已保留：' + error.message;
    }
  }

  snapshot() {
    return { drafts: structuredClone(this.drafts), error: this.error };
  }

  save(draft) {
    try {
      validateDraft(draft);
      return this.commit({ ...this.drafts, [draftKey(draft)]: structuredClone(draft) });
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  remove(key) {
    if (!Object.hasOwn(this.drafts, key)) {
      return this.error ? { ok: false, error: this.error } : { ok: true, ...this.snapshot() };
    }
    const next = { ...this.drafts };
    delete next[key];
    return this.commit(next);
  }

  commit(next) {
    if (this.error) return { ok: false, error: this.error };
    const temp = this.filePath + '.' + crypto.randomUUID() + '.tmp';
    try {
      const diskText = fs.existsSync(this.filePath) ? fs.readFileSync(this.filePath, 'utf8') : null;
      if (diskText !== this.loadedText) {
        this.load();
        this.error = '草稿文件已被其他窗口修改，输入仍保留；请先复制备份并重新打开。';
        return { ok: false, error: this.error };
      }
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const text = JSON.stringify({ schemaVersion: 1, drafts: next }, null, 2) + '\n';
      fs.writeFileSync(temp, text, { encoding: 'utf8', flag: 'wx' });
      fs.renameSync(temp, this.filePath);
      this.loadedText = text;
      this.drafts = next;
      return { ok: true, ...this.snapshot() };
    } catch (error) {
      try { fs.unlinkSync(temp); } catch { /* Nothing to clean. */ }
      return { ok: false, error: '草稿保存失败，输入仍保留：' + error.message };
    }
  }
}

module.exports = { DraftStorage, draftKey };
