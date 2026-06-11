// difficultyController.js - 难度控制系统
import { CONFIG, PROMPTS } from './config.js';

export class DifficultyController {
  constructor(initialLevel = 'medium') {
    this.currentLevel = initialLevel;
    this.levels = CONFIG.difficulty;
    this.history = [];
    this.levelOrder = ['easy', 'medium', 'hard'];
  }

  // 获取当前难度级别
  getLevel() {
    return this.currentLevel;
  }

  // 获取当前难度配置
  getConfig() {
    return this.levels[this.currentLevel];
  }

  // 获取当前难度标签
  getLabel() {
    return this.levels[this.currentLevel].label;
  }

  // 设置难度
  setLevel(level) {
    if (this.levels[level]) {
      this.currentLevel = level;
    }
  }

  // 评估是否需要调整
  evaluate(recentTurns) {
    const cfg = this.getConfig();
    const th = cfg.correctionThreshold;

    // 需要至少 3 轮数据
    if (recentTurns.length < 3) return 'maintain';

    const n = Math.min(recentTurns.length, 5);
    const lastN = recentTurns.slice(-n);

    // 统计
    const errorTurns = lastN.filter(t => t.score < CONFIG.scoring.okThreshold);
    const silentTurns = lastN.filter(t => !t.userInput || t.userInput.trim() === '');
    const perfectTurns = lastN.filter(t => t.score >= CONFIG.scoring.goodThreshold);

    const errorRate = errorTurns.length / lastN.length;

    // --- 降级条件 ---
    // 连续 2 次无响应
    if (silentTurns.length >= 2) {
      return this._downgrade('连续无响应，降低难度帮助练习');
    }

    // 错误率超过阈值
    if (errorRate > th.errorRate) {
      return this._downgrade(`错误率较高(${Math.round(errorRate * 100)}%)，调整难度`);
    }

    // --- 升级条件 ---
    // 连续 N 轮完美 + 没有无响应
    if (perfectTurns.length >= CONFIG.training.upgradeStreak && silentTurns.length === 0) {
      return this._upgrade('连续表现优秀，提升难度！');
    }

    return 'maintain';
  }

  _downgrade(reason) {
    const idx = this.levelOrder.indexOf(this.currentLevel);
    if (idx <= 0) return 'maintain'; // 已经是最低

    const from = this.currentLevel;
    this.currentLevel = this.levelOrder[idx - 1];
    this.history.push({ from, to: this.currentLevel, reason, timestamp: Date.now() });
    return 'downgrade';
  }

  _upgrade(reason) {
    const idx = this.levelOrder.indexOf(this.currentLevel);
    if (idx >= this.levelOrder.length - 1) return 'maintain'; // 已经是最高

    const from = this.currentLevel;
    this.currentLevel = this.levelOrder[idx + 1];
    this.history.push({ from, to: this.currentLevel, reason, timestamp: Date.now() });
    return 'upgrade';
  }

  // 获取该难度下的 AI 提示
  getPrompt(isCorrect) {
    const level = this.currentLevel;
    const category = isCorrect ? 'correct' : 'incorrect';
    const pool = PROMPTS[level]?.[category] || PROMPTS['medium'][category];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // 获取无响应提示
  getSilencePrompt() {
    const pool = PROMPTS[this.currentLevel]?.silence || PROMPTS['medium'].silence;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // 拆分句子（简易模式下拆分长句）
  splitSentence(sentence) {
    const maxLen = this.getConfig().sentenceLength.max;
    const words = sentence.split(/\s+/);
    if (words.length <= maxLen) return [sentence];

    const chunks = [];
    for (let i = 0; i < words.length; i += maxLen) {
      chunks.push(words.slice(i, i + maxLen).join(' '));
    }
    return chunks;
  }

  // 获取语音等待超时时间
  getSpeechTimeout() {
    return this.getConfig().speechTimeout;
  }

  // 获取 AI 响应延迟
  getResponseDelay() {
    return this.getConfig().responseDelay;
  }
}
