// dialogueManager.js - 对话管理（话轮、角色分配、对话生成）
import { ROLES } from './config.js';

export class DialogueManager {
  constructor(passageText, userRole, aiRole, difficulty) {
    this.passageText = passageText;
    this.userRole = userRole;
    this.aiRole = aiRole;
    this.difficulty = difficulty;
    this.sentences = this._parseSentences(passageText);
    this.turns = [];
    this.currentTurnIndex = -1;
    this.turnIdCounter = 0;
  }

  // 解析课文为句子数组
  _parseSentences(text) {
    if (!text) return [];

    // 按句子分隔符拆分
    const raw = text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 1);

    // 如果没有标点，按换行拆分
    if (raw.length <= 1) {
      return text
        .split(/\n+/)
        .map(s => s.trim())
        .filter(s => s.length > 1);
    }

    return raw;
  }

  // 获取总句数
  getTotalSentences() {
    return this.sentences.length;
  }

  // 是否有下一轮
  hasNextTurn() {
    return this.currentTurnIndex < this.sentences.length - 1;
  }

  // 生成下一轮对话
  generateNextTurn() {
    this.currentTurnIndex++;

    const sentence = this.sentences[this.currentTurnIndex];
    if (!sentence) return null;

    const turnId = `turn_${++this.turnIdCounter}`;
    const isUserTurn = this.currentTurnIndex % 2 === 0; // 偶数为用户回合

    // 分配角色：偶数句给用户角色，奇数句给 AI 角色
    const speakerRole = isUserTurn ? this.userRole : this.aiRole;
    const speakerName = ROLES[speakerRole]?.name || speakerRole;

    // AI 的提示语（引导用户说话）
    let aiPrompt = null;
    if (!isUserTurn) {
      aiPrompt = this._generateAIPrompt(sentence, speakerName);
    }

    const turn = {
      id: turnId,
      index: this.currentTurnIndex,
      originalText: sentence,
      aiPrompt: aiPrompt,         // AI 说的话（仅在 AI 回合时）
      speakerRole: speakerRole,
      speakerName: speakerName,
      isUserTurn: isUserTurn,
      userInput: null,
      correction: null,
      score: null,
      isCorrected: false,
      difficulty: this.difficulty,
      timestamp: Date.now()
    };

    this.turns.push(turn);
    return turn;
  }

  // 生成 AI 提示语
  _generateAIPrompt(sentence, speakerName) {
    // 简单地将课文句子作为 AI 的发言
    return {
      speaker: speakerName,
      text: sentence,
      isAI: true
    };
  }

  // 获取当前话轮
  getCurrentTurn() {
    if (this.currentTurnIndex < 0) return null;
    return this.turns[this.currentTurnIndex];
  }

  // 记录用户输入
  recordUserInput(turnId, userInput, correction) {
    const turn = this.turns.find(t => t.id === turnId);
    if (!turn) return;

    turn.userInput = userInput;
    turn.correction = correction;
    turn.score = correction?.overallScore || 0;
  }

  // 标记已纠错
  markCorrected(turnId) {
    const turn = this.turns.find(t => t.id === turnId);
    if (turn) turn.isCorrected = true;
  }

  // 获取对话进度
  getProgress() {
    return {
      current: this.currentTurnIndex + 1,
      total: this.sentences.length
    };
  }

  // 获取用户需要说的句子
  getUserSentence(turnIndex) {
    if (turnIndex < 0 || turnIndex >= this.sentences.length) return null;
    return this.sentences[turnIndex];
  }

  // 获取所有轮次记录
  getAllTurns() {
    return [...this.turns];
  }

  // 获取统计摘要
  getStats() {
    const completed = this.turns.filter(t => t.userInput !== null);
    const corrected = this.turns.filter(t => t.isCorrected);
    const perfect = this.turns.filter(t => t.score !== null && t.score >= 80);

    return {
      totalTurns: this.turns.length,
      completedTurns: completed.length,
      correctedTurns: corrected.length,
      perfectTurns: perfect.length,
      avgScore: completed.length > 0
        ? Math.round(completed.reduce((sum, t) => sum + (t.score || 0), 0) / completed.length)
        : 0
    };
  }
}
