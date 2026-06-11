// correctionEngine.js - 纠错引擎（规则匹配 + 编辑距离 + 单词对比）
import { ERROR_PATTERNS } from '../data/errorPatterns.js';
import { CONFIG } from './config.js';

export class CorrectionEngine {
  constructor() {
    this.patterns = ERROR_PATTERNS;
    this.correctedTurns = new Set(); // 本轮已纠错过的 turn ID
  }

  // 主入口：分析用户输入 vs 课文原文
  analyze(userInput, expectedText, difficulty, turnId = null) {
    // 空输入处理
    if (!userInput || userInput.trim() === '') {
      return this._emptyResponse(expectedText);
    }

    const errors = [];

    // 1. 计算整体相似度
    const similarity = this._calculateSimilarity(
      userInput.toLowerCase().trim(),
      expectedText.toLowerCase().trim()
    );

    // 2. 规则模式匹配
    const ruleErrors = this._matchPatterns(userInput, difficulty);
    errors.push(...ruleErrors);

    // 3. 单词级逐词对比
    const wordErrors = this._compareWords(userInput, expectedText);
    errors.push(...wordErrors);

    // 4. 去重
    const deduped = this._deduplicate(errors);

    // 5. 过滤：仅保留 CRITICAL 和 MAJOR 错误
    const significant = deduped.filter(e =>
      e.severity === 'critical' || e.severity === 'major'
    );

    // 6. 计算各维度分数
    const scores = this._calculateScores(significant, similarity);

    return {
      originalText: userInput.trim(),
      expectedText,
      errors: significant,
      overallScore: scores.overall,
      pronunciationScore: scores.pronunciation,
      grammarScore: scores.grammar,
      vocabularyScore: scores.vocabulary,
      fluencyScore: scores.fluency,
      isPerfect: significant.length === 0 && similarity > 0.8
    };
  }

  // 空响应
  _emptyResponse(expectedText) {
    return {
      originalText: '',
      expectedText,
      errors: [{
        type: 'missing',
        severity: 'critical',
        position: { start: 0, end: 0 },
        actual: '(无响应)',
        expected: expectedText,
        feedback: '没有听到你的声音，试着跟我说一遍吧！'
      }],
      overallScore: 0,
      pronunciationScore: 0,
      grammarScore: 0,
      vocabularyScore: 0,
      fluencyScore: 0,
      isPerfect: false
    };
  }

  // 编辑距离相似度 (Levenshtein)
  _calculateSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return 0;
    if (len2 === 0) return 0;

    const matrix = [];
    for (let i = 0; i <= len1; i++) matrix[i] = [i];
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    return 1 - distance / maxLen;
  }

  // 规则模式匹配
  _matchPatterns(userInput, difficulty) {
    const errors = [];
    const text = userInput.toLowerCase().trim();

    const allPatterns = [
      ...this.patterns.pronunciation,
      ...this.patterns.grammar,
      ...this.patterns.vocabulary,
      ...(this.patterns.fluency || [])
    ];

    for (const rule of allPatterns) {
      // 难度过滤
      if (rule.difficulty && rule.difficulty !== 'all' && rule.difficulty !== difficulty) {
        continue;
      }

      try {
        const match = text.match(rule.pattern);
        if (match) {
          errors.push({
            type: this._getErrorType(rule),
            severity: rule.severity || 'minor',
            position: { start: match.index || 0, end: (match.index || 0) + match[0].length },
            actual: match[0],
            expected: null,
            feedback: rule.suggestion || rule.description
          });
        }
      } catch (e) {
        // 正则匹配出错，跳过
      }
    }

    return errors;
  }

  _getErrorType(rule) {
    for (const type of ['pronunciation', 'grammar', 'vocabulary', 'fluency']) {
      if (this.patterns[type]?.some(r => r.id === rule.id)) return type;
    }
    return 'pronunciation';
  }

  // 单词级逐词对比
  _compareWords(userInput, expectedText) {
    const userWords = userInput.toLowerCase().trim().split(/\s+/);
    const expectedWords = expectedText.toLowerCase().trim().split(/\s+/);
    const errors = [];

    // 清理标点
    const clean = (w) => w.replace(/[.,!?;:'"]/g, '');

    const maxLen = Math.max(userWords.length, expectedWords.length);

    for (let i = 0; i < maxLen; i++) {
      const uWord = i < userWords.length ? clean(userWords[i]) : null;
      const eWord = i < expectedWords.length ? clean(expectedWords[i]) : null;

      if (!uWord && eWord) {
        // 遗漏
        errors.push({
          type: 'missing',
          severity: 'major',
          position: { start: i, end: i },
          actual: '(遗漏)',
          expected: expectedWords[i],
          feedback: `缺少单词: "${expectedWords[i]}"`
        });
        continue;
      }

      if (uWord && !eWord) {
        // 多余
        errors.push({
          type: 'vocabulary',
          severity: 'minor',
          position: { start: i, end: i },
          actual: userWords[i],
          expected: '(多余)',
          feedback: `多余单词: "${userWords[i]}"`
        });
        continue;
      }

      if (uWord && eWord && uWord !== eWord) {
        const phoneticClose = this._isPhoneticClose(uWord, eWord);

        errors.push({
          type: phoneticClose ? 'pronunciation' : 'vocabulary',
          severity: phoneticClose ? 'major' : 'critical',
          position: { start: i, end: i },
          actual: userWords[i],
          expected: expectedWords[i],
          feedback: phoneticClose
            ? `"${userWords[i]}" 听起来像 "${expectedWords[i]}"，试着发清楚一些`
            : `应该说 "${expectedWords[i]}"，而不是 "${userWords[i]}"`
        });
      }
    }

    return errors;
  }

  // 简单发音相似度 (辅音骨架对比)
  _isPhoneticClose(word1, word2) {
    const skeleton1 = word1.replace(/[aeiou]/gi, '');
    const skeleton2 = word2.replace(/[aeiou]/gi, '');
    return (
      skeleton1 === skeleton2 ||
      this._levenshtein(skeleton1, skeleton2) <= 1
    ) && Math.abs(word1.length - word2.length) <= 1;
  }

  _levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const m = [];
    for (let i = 0; i <= a.length; i++) m[i] = [i];
    for (let j = 0; j <= b.length; j++) m[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        m[i][j] = Math.min(m[i-1][j] + 1, m[i][j-1] + 1, m[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
      }
    }
    return m[a.length][b.length];
  }

  // 去重
  _deduplicate(errors) {
    const seen = new Set();
    return errors.filter(e => {
      const key = `${e.type}:${e.actual}:${e.expected}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // 计算各维度分数
  _calculateScores(errors, similarity) {
    const sc = CONFIG.scoring;
    const criticalCount = errors.filter(e => e.severity === 'critical').length;
    const majorCount = errors.filter(e => e.severity === 'major').length;
    const minorCount = errors.filter(e => e.severity === 'minor').length;

    const baseScore = similarity * 100;
    const penalty = criticalCount * sc.criticalPenalty + majorCount * sc.majorPenalty + minorCount * sc.minorPenalty;
    const overall = Math.max(0, Math.min(100, Math.round(baseScore - penalty)));

    return {
      overall,
      pronunciation: Math.max(0, Math.min(100, 100 - errors.filter(e => e.type === 'pronunciation').length * 10)),
      grammar: Math.max(0, Math.min(100, 100 - errors.filter(e => e.type === 'grammar').length * 15)),
      vocabulary: Math.max(0, Math.min(100, 100 - errors.filter(e => e.type === 'vocabulary').length * 10)),
      fluency: Math.round(similarity * 100)
    };
  }
}
