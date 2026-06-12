// uiRenderer.js - UI 渲染 & DOM 操作
import { ROLES, CONFIG } from './config.js';

export class UIRenderer {
  constructor() {
    this.panels = {};
    this.elements = {};
    this._cacheElements();
  }

  // 缓存 DOM 元素
  _cacheElements() {
    const ids = [
      'header-title', 'header-left',
      'state-idle', 'state-ocr-capturing', 'state-ocr-processing',
      'state-text-review', 'state-role-select', 'state-difficulty-select',
      'state-dialogue-ready', 'state-dialogue-active', 'state-correcting',
      'state-correction-feedback', 'state-extend-training',
      'state-report-generating', 'state-report-display', 'state-history',
      'footer-bar', 'speak-start-area', 'speak-mode-hint', 'mic-area', 'text-input-area', 'mic-waveform',
      'mic-status-text', 'mic-error-msg', 'btn-start-speaking', 'btn-skip-turn', 'btn-switch-to-text',
      'footer-actions', 'text-input-field', 'btn-text-submit',
      'dialogue-chat-area', 'dialogue-hint-area', 'dialogue-hint-text',
      'dialogue-progress', 'dialogue-diff-badge', 'compat-badge'
    ];

    for (const id of ids) {
      this.elements[id] = document.getElementById(id);
    }
  }

  // 切换到指定状态
  showState(state) {
    // 隐藏所有面板
    document.querySelectorAll('.state-panel').forEach(p => p.classList.remove('active'));

    // 映射状态到面板 ID
    const panelMap = {
      'IDLE': 'state-idle',
      'OCR_CAPTURING': 'state-ocr-capturing',
      'OCR_PROCESSING': 'state-ocr-processing',
      'TEXT_REVIEW': 'state-text-review',
      'ROLE_SELECT': 'state-role-select',
      'DIFFICULTY_SELECT': 'state-difficulty-select',
      'DIALOGUE_READY': 'state-dialogue-ready',
      'DIALOGUE_ACTIVE': 'state-dialogue-active',
      'CORRECTING': 'state-correcting',
      'CORRECTION_FEEDBACK': 'state-correction-feedback',
      'EXTEND_TRAINING': 'state-extend-training',
      'REPORT_GENERATING': 'state-report-generating',
      'REPORT_DISPLAY': 'state-report-display',
      'TEXT_INPUT': 'state-text-review',
      'HISTORY': 'state-history'
    };

    const panelId = panelMap[state];
    if (panelId) {
      const panel = document.getElementById(panelId);
      if (panel) panel.classList.add('active');
    }

    // Header title
    const titles = {
      'IDLE': '英语口语训练',
      'OCR_CAPTURING': '拍摄课文',
      'OCR_PROCESSING': '识别中…',
      'TEXT_REVIEW': '确认课文',
      'ROLE_SELECT': '选择角色',
      'DIFFICULTY_SELECT': '选择难度',
      'DIALOGUE_READY': '准备开始',
      'DIALOGUE_ACTIVE': '对话练习',
      'CORRECTING': '分析中…',
      'CORRECTION_FEEDBACK': '练习反馈',
      'EXTEND_TRAINING': '拓展练习',
      'REPORT_GENERATING': '生成报告…',
      'REPORT_DISPLAY': '训练报告',
      'HISTORY': '历史记录'
    };

    this.elements['header-title'].textContent = titles[state] || '英语口语训练';

    // Footer bar 可见性
    const showFooter = ['DIALOGUE_ACTIVE', 'CORRECTING', 'CORRECTION_FEEDBACK', 'EXTEND_TRAINING'].includes(state);
    this.elements['footer-bar'].style.display = showFooter ? 'flex' : 'none';

    // Main content padding
    this._adjustMainPadding(showFooter);
  }

  _adjustMainPadding(showFooter) {
    const main = document.getElementById('main-content');
    if (showFooter) {
      main.style.paddingBottom = '120px';
    } else {
      main.style.paddingBottom = '20px';
    }
  }

  // ========== IDLE ==========
  showCompatBadge(mode) {
    const badge = this.elements['compat-badge'];
    if (!badge) return;
    const labels = { FULL: '', TEXT_INPUT: '⚠️ 文字输入模式', VOICE_ONLY: '⚠️ 仅语音识别', TEXT_ONLY: '⚠️ 纯文字模式' };
    badge.textContent = labels[mode] || '';
  }

  // ========== OCR ==========
  showOCRPreview(imgUrl) {
    const img = document.getElementById('ocr-preview-img');
    const placeholder = document.querySelector('.ocr-placeholder');
    if (img) {
      img.src = imgUrl;
      img.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';
  }

  showOCRProgress(pct, hint) {
    const fill = document.getElementById('ocr-progress-fill');
    const text = document.getElementById('ocr-progress-text');
    const hintEl = document.getElementById('ocr-progress-hint');
    if (fill) fill.style.width = `${pct}%`;
    if (text) text.textContent = hint || '正在识别…';
    if (hintEl && pct >= 100) hintEl.textContent = '识别完成！';
  }

  // ========== TEXT_REVIEW ==========
  setReviewText(text) {
    const editor = document.getElementById('text-review-editor');
    if (editor) editor.value = text;
  }

  getReviewText() {
    const editor = document.getElementById('text-review-editor');
    return editor ? editor.value.trim() : '';
  }

  // ========== 角色/难度选择 ==========
  highlightRole(roleId) {
    document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
    const card = document.querySelector(`.role-card[data-role="${roleId}"]`);
    if (card) card.classList.add('selected');
  }

  highlightDifficulty(level) {
    document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
    const card = document.querySelector(`.diff-card[data-difficulty="${level}"]`);
    if (card) card.classList.add('selected');
  }

  // ========== DIALOGUE_READY ==========
  showReadyInfo(passage, roleName, difficultyLabel) {
    const pEl = document.getElementById('ready-passage');
    const rEl = document.getElementById('ready-role');
    const dEl = document.getElementById('ready-difficulty');
    if (pEl) pEl.textContent = passage?.substring(0, 40) + (passage?.length > 40 ? '…' : '') || '—';
    if (rEl) rEl.textContent = roleName || '—';
    if (dEl) dEl.textContent = difficultyLabel || '—';
  }

  startReadyCountdown(seconds, onComplete) {
    const el = document.getElementById('ready-countdown');
    let count = seconds;
    el.textContent = count;
    const timer = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(timer);
        el.textContent = '开始！';
        setTimeout(onComplete, 500);
      } else {
        el.textContent = count;
      }
    }, 1000);
  }

  // ========== DIALOGUE_ACTIVE ==========
  clearChat() {
    if (this.elements['dialogue-chat-area']) {
      this.elements['dialogue-chat-area'].innerHTML = '';
    }
  }

  addChatBubble(speaker, text, isUser = false, speakerAvatar = '') {
    const container = this.elements['dialogue-chat-area'];
    if (!container) return;

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${isUser ? 'user' : 'ai'}`;

    if (!isUser) {
      bubble.innerHTML = `
        <div class="chat-bubble-header">${speakerAvatar} ${speaker}</div>
        <div class="chat-bubble-text">${text}</div>
      `;
    } else {
      bubble.innerHTML = `
        <div class="chat-bubble-text">${text}</div>
      `;
    }

    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
  }

  addInterimBubble(text) {
    // 移除之前的临时气泡
    const existing = document.querySelector('.chat-bubble.recording');
    if (existing) existing.remove();

    const container = this.elements['dialogue-chat-area'];
    if (!container || !text) return;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble user recording';
    bubble.innerHTML = `<div class="chat-bubble-text">${text}…</div>`;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
  }

  removeInterimBubble() {
    const existing = document.querySelector('.chat-bubble.recording');
    if (existing) existing.remove();
  }

  updateProgress(current, total) {
    const el = this.elements['dialogue-progress'];
    if (el) el.textContent = `第 ${current}/${total} 句`;
  }

  updateDifficultyBadge(label) {
    const el = this.elements['dialogue-diff-badge'];
    if (el) el.textContent = label;
  }

  showHint(text) {
    const hintArea = this.elements['dialogue-hint-area'];
    const hintText = this.elements['dialogue-hint-text'];
    if (hintArea && hintText && text) {
      hintArea.style.display = 'block';
      hintText.textContent = text;
    } else if (hintArea) {
      hintArea.style.display = 'none';
    }
  }

  // ========== Footer Mic ==========
  setMicState(state) {
    const wave = this.elements['mic-waveform'];
    const status = this.elements['mic-status-text'];

    if (wave) {
      wave.className = ''; // reset
      if (state) wave.classList.add(state);
    }
    if (status) {
      status.className = ''; // reset
      if (state) status.classList.add(state);

      const labels = {
        'listening': '🎤 正在聆听…',
        'recognizing': '🔵 识别中…',
        'speaking': '🔊 AI 说话中…',
        'idle': '⏸ 等待中'
      };
      status.textContent = labels[state] || '';
    }
  }

  showTextInput() {
    if (this.elements['speak-start-area']) this.elements['speak-start-area'].style.display = 'none';
    if (this.elements['mic-area']) this.elements['mic-area'].style.display = 'none';
    if (this.elements['text-input-area']) this.elements['text-input-area'].style.display = 'flex';
    if (this.elements['btn-switch-to-text']) this.elements['btn-switch-to-text'].style.display = 'none';
    if (this.elements['btn-skip-turn']) this.elements['btn-skip-turn'].style.display = 'block';
  }

  showMicInput() {
    if (this.elements['speak-start-area']) this.elements['speak-start-area'].style.display = 'none';
    if (this.elements['mic-area']) this.elements['mic-area'].style.display = 'block';
    if (this.elements['text-input-area']) this.elements['text-input-area'].style.display = 'none';
    if (this.elements['btn-switch-to-text']) this.elements['btn-switch-to-text'].style.display = 'inline-block';
    if (this.elements['btn-skip-turn']) this.elements['btn-skip-turn'].style.display = 'block';
  }

  // 显示「点击开始说话」按钮
  showSpeakStart(modeHint) {
    if (this.elements['speak-start-area']) this.elements['speak-start-area'].style.display = 'block';
    if (this.elements['mic-area']) this.elements['mic-area'].style.display = 'none';
    if (this.elements['text-input-area']) this.elements['text-input-area'].style.display = 'none';
    if (this.elements['btn-switch-to-text']) this.elements['btn-switch-to-text'].style.display = 'inline-block';
    if (this.elements['btn-skip-turn']) this.elements['btn-skip-turn'].style.display = 'block';
    // 显示模式提示
    if (this.elements['speak-mode-hint']) {
      this.elements['speak-mode-hint'].textContent = modeHint || '';
    }
  }

  // 开始说话后隐藏按钮
  hideSpeakStart() {
    if (this.elements['speak-start-area']) this.elements['speak-start-area'].style.display = 'none';
  }

  // 显示麦克风错误
  showMicError(msg) {
    if (this.elements['mic-error-msg']) {
      this.elements['mic-error-msg'].style.display = 'block';
      this.elements['mic-error-msg'].textContent = msg;
    }
  }

  hideMicError() {
    if (this.elements['mic-error-msg']) {
      this.elements['mic-error-msg'].style.display = 'none';
    }
  }

  getTextInput() {
    const field = this.elements['text-input-field'];
    return field ? field.value.trim() : '';
  }

  clearTextInput() {
    const field = this.elements['text-input-field'];
    if (field) field.value = '';
  }

  showSkipButton(visible) {
    const btn = this.elements['btn-skip-turn'];
    if (btn) btn.style.display = visible ? 'block' : 'none';
  }

  // ========== CORRECTION_FEEDBACK ==========
  showCorrection(userText, expectedText, errors, isPerfect) {
    // 用户说的
    const userEl = document.getElementById('correction-user-text');
    if (userEl) {
      if (userText) {
        let highlighted = userText;
        for (const err of errors) {
          if (err.actual && err.actual !== '(遗漏)' && err.actual !== '(无响应)') {
            highlighted = highlighted.replace(
              err.actual,
              `<span class="correction-error-word">${err.actual}</span>`
            );
          }
        }
        userEl.innerHTML = highlighted;
      } else {
        userEl.innerHTML = '<span class="correction-error-word">(无响应)</span>';
      }
    }

    // 正确句子
    const correctEl = document.getElementById('correction-correct-text');
    if (correctEl) correctEl.textContent = expectedText;

    // 纠错结果
    const resultArea = document.getElementById('correction-result-area');
    if (resultArea) {
      if (isPerfect) {
        resultArea.innerHTML = `
          <div class="correction-perfect">
            <span class="perfect-icon">✅</span>
            <div class="perfect-text">非常完美！</div>
          </div>`;
      } else if (errors.length > 0) {
        resultArea.innerHTML = '<div style="font-size:14px;font-weight:600;margin-bottom:8px;">💡 改进建议：</div>' +
          errors.map(e => `
            <div class="correction-error-item">
              <span class="correction-error-type ${e.type}">${
                {pronunciation:'🗣 发音', grammar:'📝 语法', vocabulary:'📖 用词', missing:'⚠️ 遗漏'}[e.type] || '错误'
              }</span>
              <div class="correction-error-feedback">${e.feedback}</div>
            </div>
          `).join('');
      } else {
        resultArea.innerHTML = '<div style="text-align:center;color:#888;">继续加油！</div>';
      }
    }

    // 倒计时重置
    const cdEl = document.getElementById('correction-countdown');
    if (cdEl) cdEl.textContent = '';
    if (document.getElementById('btn-retry-sentence')) {
      document.getElementById('btn-retry-sentence').style.display = 'inline-flex';
    }
  }

  startCorrectionCountdown(seconds, onComplete) {
    const el = document.getElementById('correction-countdown');
    if (!el) return;
    let count = seconds;
    el.textContent = `${count} 秒后自动重试…`;
    const timer = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(timer);
        el.textContent = '';
        onComplete();
      } else {
        el.textContent = `${count} 秒后自动重试…`;
      }
    }, 1000);
    return timer;
  }

  // ========== EXTEND_TRAINING ==========
  showExtendExercise(exercise) {
    const badge = document.getElementById('extend-phase-badge');
    const prompt = document.getElementById('extend-prompt-text');
    const original = document.getElementById('extend-original-text');
    const newText = document.getElementById('extend-new-text');
    const options = document.getElementById('extend-options-area');

    if (badge) badge.textContent = exercise.phaseLabel || `阶段 ${exercise.phase}/2`;
    if (prompt) prompt.textContent = exercise.prompt || '换个词试试吧！';
    if (original) original.textContent = exercise.original;
    if (newText) {
      newText.innerHTML = exercise.template.replace('________', '<span style="color:#4A90D9;font-weight:700;">?</span>');
    }
    if (options && exercise.alternatives) {
      options.innerHTML = exercise.alternatives.map(w =>
        `<div class="extend-option" data-word="${w}">${w}</div>`
      ).join('');
    }
  }

  highlightExtendOption(word) {
    document.querySelectorAll('.extend-option').forEach(o => o.classList.remove('selected'));
    const opt = document.querySelector(`.extend-option[data-word="${word}"]`);
    if (opt) opt.classList.add('selected');
  }

  // ========== REPORT_DISPLAY ==========
  showReport(report) {
    const body = document.getElementById('report-body');
    if (!body) return;

    const stars = (s) => {
      if (s >= 90) return '⭐⭐⭐⭐⭐';
      if (s >= 75) return '⭐⭐⭐⭐';
      if (s >= 60) return '⭐⭐⭐';
      if (s >= 40) return '⭐⭐';
      return '⭐';
    };

    body.innerHTML = `
      <div class="report-score">
        <div class="report-score-big">${report.overallScore}</div>
        <div class="report-score-label">综合评分 / 100</div>
      </div>

      <div class="report-card">
        <div class="report-card-title">📊 训练概览</div>
        <div class="report-stats-grid">
          <div class="report-stat-item">
            <div class="report-stat-value">${report.stats.totalTurns}</div>
            <div class="report-stat-label">总句数</div>
          </div>
          <div class="report-stat-item">
            <div class="report-stat-value">${report.stats.goodTurns}</div>
            <div class="report-stat-label">正确句</div>
          </div>
          <div class="report-stat-item">
            <div class="report-stat-value">${report.stats.okTurns + report.stats.badTurns}</div>
            <div class="report-stat-label">需改进句</div>
          </div>
          <div class="report-stat-item">
            <div class="report-stat-value">${report.duration}s</div>
            <div class="report-stat-label">训练时长</div>
          </div>
        </div>
      </div>

      <div class="report-card">
        <div class="report-card-title">📈 能力评分</div>
        <div class="report-dimension">
          <span class="report-dimension-name">🗣 发音</span>
          <span class="report-dimension-stars">${stars(report.pronunciationScore)} ${report.pronunciationScore}</span>
        </div>
        <div class="report-dimension">
          <span class="report-dimension-name">📝 语法</span>
          <span class="report-dimension-stars">${stars(report.grammarScore)} ${report.grammarScore}</span>
        </div>
        <div class="report-dimension">
          <span class="report-dimension-name">📖 词汇</span>
          <span class="report-dimension-stars">${stars(report.vocabularyScore)} ${report.vocabularyScore}</span>
        </div>
        <div class="report-dimension">
          <span class="report-dimension-name">💨 流畅度</span>
          <span class="report-dimension-stars">${stars(report.fluencyScore)} ${report.fluencyScore}</span>
        </div>
      </div>

      <div class="report-card">
        <div class="report-card-title">📋 逐句记录</div>
        ${report.turns.map((t, i) => {
          const cls = t.score >= 80 ? 'good' : (t.score >= 60 ? 'ok' : 'bad');
          const icon = t.score >= 80 ? '✅' : (t.score >= 60 ? '⚠️' : '❌');
          return `
            <div class="report-turn-item">
              <div class="report-turn-header">
                <span class="report-turn-num">句${i+1}</span>
                <span class="report-turn-score ${cls}">${icon} ${t.score || 0}分</span>
              </div>
              <div class="report-turn-text">原文: ${t.originalText}</div>
              <div class="report-turn-text">你说: ${t.userInput}</div>
            </div>
          `;
        }).join('')}
      </div>

      ${report.weakPoints.length > 0 ? `
      <div class="report-card">
        <div class="report-card-title">🎯 薄弱环节</div>
        ${report.weakPoints.map(w => `
          <div class="report-weak-item">
            <div class="report-weak-category">${w.description}</div>
            <div class="report-weak-count">出现 ${w.count} 次</div>
          </div>
        `).join('')}
      </div>
      ` : ''}

      ${report.progressTrend.improved ? `
      <div class="report-card" style="background:#F6FFED;border:1px solid #52C41A;">
        <div class="report-card-title">📈 进步趋势</div>
        <div style="font-size:14px;">前半段正确率: ${report.progressTrend.firstHalfAccuracy}% → 后半段正确率: ${report.progressTrend.secondHalfAccuracy}%</div>
        <div style="color:#52C41A;font-weight:600;margin-top:4px;">👍 有明显进步！</div>
      </div>
      ` : ''}

      <div class="report-card">
        <div class="report-card-title">💪 建议练习</div>
        ${report.recommendedExercises.map(r => `<div class="report-rec-item">${r}</div>`).join('')}
      </div>
    `;
  }

  // ========== HISTORY ==========
  showHistory(reports) {
    const list = document.getElementById('history-list');
    if (!list) return;

    if (!reports || reports.length === 0) {
      list.innerHTML = '<p class="history-empty">暂无训练记录</p>';
      return;
    }

    list.innerHTML = reports
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map(r => {
        const date = new Date(r.date).toLocaleString('zh-CN', {
          month: 'numeric', day: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
        return `
          <div class="history-item" data-report-id="${r.id}">
            <div class="history-item-date">${date}</div>
            <div class="history-item-score">${r.overallScore} 分</div>
            <div class="history-item-text">${r.originalPassage?.substring(0, 30) || ''}…</div>
          </div>
        `;
      }).join('');
  }
}
