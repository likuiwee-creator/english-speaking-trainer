// trainingRecorder.js - 训练记录 & 报告生成
import { CONFIG } from './config.js';

export class TrainingRecorder {
  constructor(dialogueManager, difficultyController) {
    this.dialogue = dialogueManager;
    this.difficulty = difficultyController;
    this.startTime = Date.now();
    this.turnLogs = [];
  }

  // 记录一轮
  logTurn(turn) {
    this.turnLogs.push({
      turnIndex: turn.index,
      turnId: turn.id,
      timestamp: turn.timestamp,
      originalText: turn.originalText,
      aiPrompt: turn.aiPrompt?.text || null,
      userInput: turn.userInput || null,
      correction: turn.correction || null,
      score: turn.score,
      difficulty: turn.difficulty,
      isCorrected: turn.isCorrected || false
    });
  }

  // 记录拓展练习
  logExtendExercise(exercise) {
    this.turnLogs.push({
      turnIndex: -1, // 拓展练习
      turnId: `extend_${Date.now()}`,
      timestamp: Date.now(),
      originalText: exercise.original,
      aiPrompt: exercise.template,
      userInput: null,
      correction: null,
      score: null,
      difficulty: this.difficulty.getLevel(),
      isCorrected: false,
      isExtend: true,
      phase: exercise.phase
    });
  }

  // 生成训练报告
  generateReport(role, originalPassage, extendExercises = []) {
    const allTurns = this.turnLogs.filter(t => !t.isExtend);
    const extendTurns = this.turnLogs.filter(t => t.isExtend);

    // 基本统计
    const totalTurns = allTurns.length;
    const completedTurns = allTurns.filter(t => t.userInput !== null);
    const goodTurns = allTurns.filter(t => t.score !== null && t.score >= CONFIG.scoring.goodThreshold);
    const okTurns = allTurns.filter(t => t.score !== null && t.score >= CONFIG.scoring.okThreshold && t.score < CONFIG.scoring.goodThreshold);
    const badTurns = allTurns.filter(t => t.score !== null && t.score < CONFIG.scoring.okThreshold);
    const silentTurns = allTurns.filter(t => t.userInput === null || t.userInput.trim() === '');

    // 平均分
    const scoredTurns = allTurns.filter(t => t.score !== null);
    const avgScore = scoredTurns.length > 0
      ? Math.round(scoredTurns.reduce((s, t) => s + t.score, 0) / scoredTurns.length)
      : 0;

    // 综合评分
    const pronunciationScore = scoredTurns.length > 0
      ? Math.round(scoredTurns.reduce((s, t) => s + (t.correction?.pronunciationScore || 70), 0) / scoredTurns.length)
      : 0;
    const grammarScore = scoredTurns.length > 0
      ? Math.round(scoredTurns.reduce((s, t) => s + (t.correction?.grammarScore || 70), 0) / scoredTurns.length)
      : 0;
    const vocabularyScore = scoredTurns.length > 0
      ? Math.round(scoredTurns.reduce((s, t) => s + (t.correction?.vocabularyScore || 70), 0) / scoredTurns.length)
      : 0;
    const fluencyScore = scoredTurns.length > 0
      ? Math.round(scoredTurns.reduce((s, t) => s + (t.correction?.fluencyScore || 70), 0) / scoredTurns.length)
      : 0;

    const overallScore = Math.round(
      pronunciationScore * CONFIG.scoring.pronunciationWeight +
      grammarScore * CONFIG.scoring.grammarWeight +
      vocabularyScore * CONFIG.scoring.vocabularyWeight +
      fluencyScore * CONFIG.scoring.fluencyWeight
    );

    // 薄弱环节分析
    const weakPoints = this._analyzeWeakPoints(allTurns);

    // 进步趋势
    const mid = Math.floor(totalTurns / 2);
    const firstHalf = allTurns.slice(0, mid).filter(t => t.score !== null);
    const secondHalf = allTurns.slice(mid).filter(t => t.score !== null);
    const firstAcc = firstHalf.length > 0
      ? Math.round(firstHalf.filter(t => t.score >= CONFIG.scoring.goodThreshold).length / firstHalf.length * 100)
      : 0;
    const secondAcc = secondHalf.length > 0
      ? Math.round(secondHalf.filter(t => t.score >= CONFIG.scoring.goodThreshold).length / secondHalf.length * 100)
      : 0;

    // 平均响应时间
    const avgResponseTime = completedTurns.length > 0
      ? Math.round(completedTurns.reduce((s, t) => s + ((t.timestamp - (allTurns[t.turnIndex - 1]?.timestamp || t.timestamp)) || 0), 0) / completedTurns.length / 1000)
      : 0;

    // 推荐练习
    const recommendations = this._generateRecommendations(weakPoints);

    return {
      id: `report_${Date.now()}`,
      date: new Date().toISOString(),
      originalPassage,
      role: role,
      startDifficulty: this.difficulty.history[0]?.from || this.difficulty.getLevel(),
      endDifficulty: this.difficulty.getLevel(),
      duration: Math.round((Date.now() - this.startTime) / 1000),

      overallScore,
      pronunciationScore,
      grammarScore,
      vocabularyScore,
      fluencyScore,

      stats: {
        totalTurns,
        completedTurns: completedTurns.length,
        goodTurns: goodTurns.length,
        okTurns: okTurns.length,
        badTurns: badTurns.length,
        silentTurns: silentTurns.length,
        avgScore,
        avgResponseTime,
        difficultyChanges: this.difficulty.history
      },

      turns: allTurns.map(t => ({
        index: t.turnIndex + 1,
        originalText: t.originalText,
        userInput: t.userInput || '(无响应)',
        score: t.score,
        errors: t.correction?.errors || [],
        isCorrected: t.isCorrected
      })),

      weakPoints,
      progressTrend: {
        firstHalfAccuracy: firstAcc,
        secondHalfAccuracy: secondAcc,
        improved: secondAcc >= firstAcc
      },

      extendExercises: extendExercises,

      recommendedExercises: recommendations
    };
  }

  // 薄弱环节分析
  _analyzeWeakPoints(allTurns) {
    const errorMap = new Map();

    for (const turn of allTurns) {
      const errors = turn.correction?.errors || [];
      for (const err of errors) {
        const key = `${err.type}:${err.feedback}`;
        if (!errorMap.has(key)) {
          errorMap.set(key, {
            type: err.type,
            description: err.feedback,
            examples: [err.actual],
            count: 1
          });
        } else {
          const existing = errorMap.get(key);
          existing.count++;
          if (!existing.examples.includes(err.actual)) {
            existing.examples.push(err.actual);
          }
        }
      }
    }

    return Array.from(errorMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(wp => ({
        category: wp.type,
        description: wp.description,
        examples: wp.examples.slice(0, 3),
        count: wp.count
      }));
  }

  // 生成推荐练习
  _generateRecommendations(weakPoints) {
    const recs = [];

    for (const wp of weakPoints.slice(0, 3)) {
      if (wp.category === 'pronunciation') {
        recs.push(`重点练习 ${wp.examples.join(', ')} 的发音`);
      } else if (wp.category === 'grammar') {
        recs.push(`复习语法点: ${wp.description}`);
      } else if (wp.category === 'vocabulary') {
        recs.push(`注意用词: ${wp.description}`);
      } else if (wp.category === 'missing') {
        recs.push('多开口说，不要害怕犯错');
      }
    }

    if (recs.length === 0) {
      recs.push('继续保持，你做得很好！');
      recs.push('可以尝试更高难度的训练');
    }

    return recs;
  }
}
