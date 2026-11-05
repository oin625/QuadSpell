'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseBoard, normalizeDemand, timestamp, quadrants } = require('./model.cjs');

class DemandStorage {
  constructor(filePath) {
    this.filePath = filePath;
    this.demands = [];
    this.loadError = null;
    this.load();
  }

  load() {
    if (!fs.existsSync(this.filePath)) {
      this.demands = [];
      this.loadError = null;
      return this.snapshot();
    }
    try {
      const board = parseBoard(fs.readFileSync(this.filePath, 'utf8'));
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
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(temp, JSON.stringify({ schemaVersion: 1, demands: next }, null, 2) + '\n', {
        encoding: 'utf8', flag: 'wx'
      });
      fs.renameSync(temp, this.filePath);
      this.demands = next;
      return { ok: true, demands: this.demands };
    } catch (error) {
      try { fs.unlinkSync(temp); } catch { /* no temporary file to clean */ }
      return { ok: false, error: `保存失败：${error.message}` };
    }
  }

  upsert(input, progressText = '') {
    try {
      const index = this.demands.findIndex(demand => demand.id === input?.id);
      const saved = normalizeDemand(input, index >= 0 ? this.demands[index] : null);
      const text = typeof progressText === 'string' ? progressText.trim() : '';
      if (text) saved.progress.push({ id: crypto.randomUUID(), createdAt: timestamp(), text });
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

  remove(id) {
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
