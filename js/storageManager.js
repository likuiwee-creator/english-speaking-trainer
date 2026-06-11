// storageManager.js - IndexedDB 持久化 + localStorage 降级
import { CONFIG } from './config.js';

export class StorageManager {
  constructor() {
    this.db = null;
    this.fallback = null; // 'localStorage' | null
  }

  // 初始化
  async init() {
    if (!window.indexedDB) {
      this.fallback = 'localStorage';
      return;
    }

    return new Promise((resolve) => {
      const request = indexedDB.open(CONFIG.storage.dbName, CONFIG.storage.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('reports')) {
          db.createObjectStore('reports', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };

      request.onerror = () => {
        console.warn('IndexedDB 不可用，降级到 localStorage');
        this.fallback = 'localStorage';
        resolve();
      };
    });
  }

  // 保存训练报告
  async saveReport(report) {
    if (this.fallback === 'localStorage') {
      return this._lsSave('reports', report);
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction('reports', 'readwrite');
        const store = tx.objectStore('reports');
        store.put(report);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  // 获取所有报告
  async getReports() {
    if (this.fallback === 'localStorage') {
      return this._lsGetAll('reports');
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction('reports', 'readonly');
        const store = tx.objectStore('reports');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  // 删除报告
  async deleteReport(id) {
    if (this.fallback === 'localStorage') {
      return this._lsDelete('reports', id);
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction('reports', 'readwrite');
        const store = tx.objectStore('reports');
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  // localStorage 辅助
  _lsSave(key, item) {
    try {
      const items = JSON.parse(localStorage.getItem(`et_${key}`) || '[]');
      // 去重替换
      const idx = items.findIndex(i => i.id === item.id);
      if (idx >= 0) items[idx] = item;
      else items.push(item);
      localStorage.setItem(`et_${key}`, JSON.stringify(items));
    } catch (e) {
      console.error('localStorage save error:', e);
    }
  }

  _lsGetAll(key) {
    try {
      return JSON.parse(localStorage.getItem(`et_${key}`) || '[]');
    } catch (e) {
      return [];
    }
  }

  _lsDelete(key, id) {
    try {
      const items = JSON.parse(localStorage.getItem(`et_${key}`) || '[]');
      const filtered = items.filter(i => i.id !== id);
      localStorage.setItem(`et_${key}`, JSON.stringify(filtered));
    } catch (e) {
      console.error('localStorage delete error:', e);
    }
  }
}
