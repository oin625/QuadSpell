'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseBoard, normalizeDemand, timestamp, quadrants, emptyHandoff, sameDemand } = require('./model.cjs');

class DemandStorage {
  constructor(filePath) {
    this.filePath = filePath;
    this.demands = [];
    this.loadError = null;
    this.loadedText = null;
    this.load();
  }

  load() {
    if (!fs.existsSync(this.filePath)) {
      this.demands = [];
      this.loadedText = null;
      this.loadError = null;
      return this.snapshot();
    }
    try {
      const text = fs.readFileSync(this.filePath, 'utf8');
      const board = parseBoard(text);
      this.loadedText = text;
      this.demands = board.demands;
      this.loadError = null;
    } catch (error) {
      this.loadError = `无法读取本地需求数据：${error.message}。原文件已保留，写入已暂停。`;
    }
    return this.snapshot();
  }

  snapshot() {
    return { demands: this.demands, error: this.loadError };
  }

  commit(next) {
    if (this.loadError) return { ok: false, error: this.loadError };
    const temp = `${this.filePath}.${crypto.randomUUID()}.tmp`;
    try {
      const diskText = fs.existsSync(this.filePath) ? fs.readFileSync(this.filePath, 'utf8') : null;
      if (diskText !== this.loadedText) {
        this.load();
        return { ok: false, error: '本地数据已被其他窗口或程序修改，草稿已保留；请重新打开需求核对后再保存。' };
      }
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const text = JSON.stringify({ schemaVersion: 2, demands: next }, null, 2) + '\n';
      fs.writeFileSync(temp, text, {
        encoding: 'utf8', flag: 'wx'
      });
      fs.renameSync(temp, this.filePath);
      this.loadedText = text;
      this.demands = next;
      return { ok: true, demands: this.demands };
    } catch (error) {
      try { fs.unlinkSync(temp); } catch { /* no temporary file to clean */ }
      return { ok: false, error: `保存失败：${error.message}` };
    }
  }

  upsert(input, progressText = '', expected = null, changeText = '') {
    try {
      const index = this.demands.findIndex(demand => demand.id === input?.id);
      const current = index >= 0 ? this.demands[index] : null;
      if (!sameDemand(current, expected)) {
        return { ok: false, error: '需求已发生变化，草稿已保留；请关闭后重新打开核对，避免覆盖新内容。' };
      }
      const saved = normalizeDemand(input, current);
      const text = typeof progressText === 'string' ? progressText.trim() : '';
      if (text) saved.progress.push({ id: crypto.randomUUID(), createdAt: timestamp(), text });
      const change = typeof changeText === 'string' ? changeText.trim() : '';
      if (change) saved.changes.push({ id: crypto.randomUUID(), createdAt: timestamp(), text: change });
      const previous = current?.handoff ?? emptyHandoff();
      if (['completed', 'pending', 'decisions', 'verification'].some(key => saved.handoff[key] !== previous[key])) {
        saved.handoff.coveredProgressCount = saved.handoff.pending.trim() && saved.handoff.verification.trim() ? saved.progress.length : 0;
      }
      const next = [...this.demands];
      if (index >= 0) next[index] = saved;
      else next.push(saved);
      return this.commit(next);
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  move(id, quadrant) {
    if (!quadrants.includes(quadrant)) return { ok: false, error: '四象限分类无效' };
    const index = this.demands.findIndex(demand => demand.id === id);
    if (index < 0) return { ok: false, error: '需求不存在' };
    if (this.demands[index].quadrant === quadrant) return { ok: true, demands: this.demands };
    const next = [...this.demands];
    next[index] = { ...next[index], quadrant, updatedAt: timestamp() };
    return this.commit(next);
  }

  remove(id, expected = null) {
    if (expected && !sameDemand(this.copyable(id), expected)) {
      return { ok: false, error: '需求已发生变化，请重新打开核对后再删除。' };
    }
    if (!this.demands.some(demand => demand.id === id)) {
      return { ok: false, error: '需求不存在' };
    }
    return this.commit(this.demands.filter(demand => demand.id !== id));
  }

  copyable(id) {
    return this.demands.find(demand => demand.id === id) ?? null;
  }
}

module.exports = { DemandStorage };
