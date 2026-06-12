// pronunciationAnalyzer.js - 发音质量评价引擎
// 录音 blob → 声学特征分析 + 文本对比 → 多维度评分报告

export class PronunciationAnalyzer {
  constructor() {
    this.audioContext = null;
  }

  // 主入口：分析录音并给出评价
  async analyze(audioBlob, expectedText, userText = null) {
    const report = {
      overall: 0,
      accuracy: { score: 0, label: '音准', detail: '' },
      fluency: { score: 0, label: '流畅度', detail: '' },
      completeness: { score: 0, label: '完整度', detail: '' },
      intonation: { score: 0, label: '语调', detail: '' },
      suggestions: [],
      stars: ''
    };

    try {
      // 1. 声学分析
      const acoustic = await this._acousticAnalysis(audioBlob, expectedText);
      report.fluency.score = acoustic.fluencyScore;
      report.fluency.detail = acoustic.fluencyDetail;
      report.intonation.score = acoustic.intonationScore;
      report.intonation.detail = acoustic.intonationDetail;

      // 2. 文本对比（说了什么 vs 该说什么）
      if (userText) {
        const textResult = this._textComparison(userText, expectedText);
        report.accuracy.score = textResult.accuracyScore;
        report.accuracy.detail = textResult.accuracyDetail;
        report.completeness.score = textResult.completenessScore;
        report.completeness.detail = textResult.completenessDetail;
        report.suggestions.push(...textResult.suggestions);
      } else {
        // 无文字输入，只能评估声学特征
        report.accuracy.score = Math.round(acoustic.fluencyScore * 0.8);
        report.accuracy.detail = '（未获取到识别文本，基于声音特征评估）';
        report.completeness.score = 50;
        report.completeness.detail = '建议尝试在安静环境中朗读';
      }

      // 3. 综合评分
      report.overall = Math.round(
        report.accuracy.score * 0.35 +
        report.fluency.score * 0.25 +
        report.completeness.score * 0.20 +
        report.intonation.score * 0.20
      );

      // 4. 星级
      report.stars = report.overall >= 90 ? '⭐⭐⭐⭐⭐' :
                     report.overall >= 75 ? '⭐⭐⭐⭐' :
                     report.overall >= 60 ? '⭐⭐⭐' :
                     report.overall >= 40 ? '⭐⭐' : '⭐';

      // 5. 改进建议
      if (acoustic.suggestions) report.suggestions.push(...acoustic.suggestions);

      return report;
    } catch (e) {
      console.warn('[PronunciationAnalyzer] Error:', e.message);
      report.overall = 50;
      report.accuracy.detail = '分析出错，请重试';
      return report;
    }
  }

  // ========== 声学特征分析 ==========
  async _acousticAnalysis(audioBlob, expectedText) {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

    const duration = audioBuffer.duration;
    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0);

    // --- 能量分析 (RMS) ---
    const rms = this._calculateRMS(channelData);

    // --- 检测停顿 ---
    const pauses = this._detectPauses(channelData, sampleRate);

    // --- 语速 ---
    const expectedWordCount = (expectedText || '').split(/\s+/).length;
    const wordsPerMinute = duration > 0 ? (expectedWordCount / duration) * 60 : 0;
    const idealWPM = 100; // 小学生理想语速 100 词/分钟

    // --- 流畅度评分 ---
    let fluencyScore = 100;
    let fluencyDetail = '';
    const suggestions = [];

    // 停顿过多
    if (pauses.count > 5) {
      fluencyScore -= Math.min(30, (pauses.count - 5) * 5);
      suggestions.push('朗读中有较多停顿，试着连起来读更流畅');
    }
    // 语速
    if (wordsPerMinute < 30) {
      fluencyScore -= 25;
      fluencyDetail = '语速偏慢，试着加快一点';
    } else if (wordsPerMinute > 180) {
      fluencyScore -= 15;
      fluencyDetail = '语速偏快，放慢一点更清晰';
    } else if (wordsPerMinute >= 60 && wordsPerMinute <= 140) {
      fluencyDetail = '语速适中，节奏很好 👍';
    } else {
      fluencyDetail = '语速尚可，继续加油';
    }

    // 声音太小
    if (rms < 0.02) {
      fluencyScore -= 20;
      suggestions.push('声音偏小，试着大声朗读');
      fluencyDetail += '（声音偏小）';
    } else if (rms > 0.3) {
      fluencyDetail += '（音量适中 ✅）';
    }

    fluencyScore = Math.max(0, Math.min(100, fluencyScore));

    // --- 语调评分 ---
    let intonationScore = 70;
    let intonationDetail = '';

    // 检测音高变化（简化版：能量标准差作为语调变化的代理）
    const energyVariation = this._calculateEnergyVariation(channelData);
    if (energyVariation > 0.1) {
      intonationScore = 85;
      intonationDetail = '语调有起伏，听起来很自然 👍';
    } else if (energyVariation > 0.04) {
      intonationScore = 70;
      intonationDetail = '语调有一定变化，可以更富有感情';
    } else {
      intonationScore = 50;
      intonationDetail = '语调偏平淡，试着模仿课文的升降调';
      suggestions.push('朗读时注意语调有升有降，让英语更自然');
    }

    return {
      fluencyScore,
      fluencyDetail,
      intonationScore,
      intonationDetail,
      suggestions,
      acoustic: { duration, rms, pauses: pauses.count, wpm: Math.round(wordsPerMinute), energyVariation }
    };
  }

  // RMS 均方根 (音量)
  _calculateRMS(data) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    return Math.sqrt(sum / data.length);
  }

  // 检测停顿 (能量低于阈值的连续片段)
  _detectPauses(data, sampleRate, threshold = 0.01, minPauseMs = 300) {
    const minSamples = (minPauseMs / 1000) * sampleRate;
    let pauseCount = 0;
    let currentPause = 0;

    for (let i = 0; i < data.length; i++) {
      if (Math.abs(data[i]) < threshold) {
        currentPause++;
      } else {
        if (currentPause >= minSamples) pauseCount++;
        currentPause = 0;
      }
    }
    if (currentPause >= minSamples) pauseCount++;

    return { count: pauseCount };
  }

  // 能量变化 (语调起伏的代理)
  _calculateEnergyVariation(data) {
    const windowSize = Math.floor(data.length / 50); // 50 个窗口
    if (windowSize < 100) return 0;

    const windowEnergies = [];
    for (let i = 0; i < data.length; i += windowSize) {
      let sum = 0;
      const end = Math.min(i + windowSize, data.length);
      for (let j = i; j < end; j++) sum += data[j] * data[j];
      windowEnergies.push(Math.sqrt(sum / (end - i)));
    }

    const mean = windowEnergies.reduce((a, b) => a + b, 0) / windowEnergies.length;
    const variance = windowEnergies.reduce((s, e) => s + (e - mean) ** 2, 0) / windowEnergies.length;
    return Math.sqrt(variance);
  }

  // ========== 文本对比 ==========
  _textComparison(userText, expectedText) {
    const uWords = (userText || '').toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
    const eWords = (expectedText || '').toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);

    if (eWords.length === 0) {
      return { accuracyScore: 70, accuracyDetail: '', completenessScore: 100, completenessDetail: '', suggestions: [] };
    }

    // 逐词匹配
    let matched = 0;
    let partialMatched = 0;
    const suggestions = [];

    for (let i = 0; i < eWords.length; i++) {
      const clean = (w) => w.replace(/[.,!?;:'"]/g, '');
      const ew = clean(eWords[i]);

      if (i < uWords.length) {
        const uw = clean(uWords[i]);
        if (uw === ew) {
          matched++;
        } else if (this._areSimilar(uw, ew)) {
          partialMatched++;
          suggestions.push(`"${uw}" 听起来像 "${ew}"，注意发音区分`);
        }
      }
    }

    // 完整度
    const completeness = Math.round((uWords.length / eWords.length) * 100);
    const clampedCompleteness = Math.min(100, Math.max(0, completeness));

    let completenessDetail = '';
    if (uWords.length < eWords.length) {
      const missing = eWords.length - uWords.length;
      completenessDetail = `少了 ${missing} 个词，试着把整句话说完`;
    } else if (uWords.length > eWords.length) {
      completenessDetail = '多说了几个词，注意跟读原文';
    } else {
      completenessDetail = '句子完整 ✅';
    }

    // 准确度
    const accuracyScore = eWords.length > 0
      ? Math.round(((matched + partialMatched * 0.5) / eWords.length) * 100)
      : 100;

    let accuracyDetail = '';
    if (accuracyScore >= 90) accuracyDetail = '发音清晰准确，非常棒！';
    else if (accuracyScore >= 70) accuracyDetail = `正确 ${matched}/${eWords.length} 个词，继续加油`;
    else if (accuracyScore >= 40) accuracyDetail = `有 ${matched} 个词说对了，再多练几遍`;
    else accuracyDetail = '和原文差距较大，听听示范再试试';

    // 限制建议数量
    const topSuggestions = suggestions.slice(0, 3);

    return {
      accuracyScore: Math.max(0, Math.min(100, accuracyScore)),
      accuracyDetail,
      completenessScore: clampedCompleteness,
      completenessDetail,
      suggestions: topSuggestions
    };
  }

  // 单词相似度 (编辑距离)
  _areSimilar(w1, w2) {
    if (w1 === w2) return true;
    if (Math.abs(w1.length - w2.length) > 2) return false;
    let diff = 0;
    const minLen = Math.min(w1.length, w2.length);
    for (let i = 0; i < minLen; i++) {
      if (w1[i] !== w2[i]) diff++;
    }
    diff += Math.abs(w1.length - w2.length);
    return diff <= 2;
  }
}
