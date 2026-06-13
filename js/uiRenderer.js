// uiRenderer.js - UI 渲染 & DOM 操作
import { ROLES, CONFIG } from './config.js';

export class UIRenderer {
  constructor() {
    this.elements = {};
    this._cache();
  }

  _cache() {
    const ids = [
      'header-title', 'text-input-field', 'btn-text-submit', 'btn-mic', 'btn-skip-turn',
      'mic-status-bar', 'mic-status-text',
      'dialogue-chat-area', 'dialogue-hint-area', 'dialogue-hint-text',
      'dialogue-progress', 'dialogue-diff-badge', 'compat-badge'
    ];
    for (const id of ids) {
      this.elements[id] = document.getElementById(id);
    }
  }

  showState(state) {
    document.querySelectorAll('.state-panel').forEach(p => p.classList.remove('active'));
    const map = {
      'IDLE': 'state-idle', 'OCR_CAPTURING': 'state-ocr-capturing',
      'OCR_PROCESSING': 'state-ocr-processing', 'TEXT_REVIEW': 'state-text-review',
      'ROLE_SELECT': 'state-role-select', 'DIFFICULTY_SELECT': 'state-difficulty-select',
      'DIALOGUE_READY': 'state-dialogue-ready', 'DIALOGUE_ACTIVE': 'state-dialogue-active',
      'CORRECTING': 'state-correcting', 'CORRECTION_FEEDBACK': 'state-correction-feedback',
      'EXTEND_TRAINING': 'state-extend-training', 'REPORT_GENERATING': 'state-report-generating',
      'REPORT_DISPLAY': 'state-report-display', 'TEXT_INPUT': 'state-text-review',
      'HISTORY': 'state-history'
    };
    const panel = document.getElementById(map[state]);
    if (panel) panel.classList.add('active');

    const titles = {
      'IDLE': '英语口语训练', 'OCR_CAPTURING': '拍摄课文', 'OCR_PROCESSING': '识别中…',
      'TEXT_REVIEW': '确认课文', 'ROLE_SELECT': '选择角色', 'DIFFICULTY_SELECT': '选择难度',
      'DIALOGUE_READY': '准备开始', 'DIALOGUE_ACTIVE': '对话练习', 'CORRECTING': '分析中…',
      'CORRECTION_FEEDBACK': '练习反馈', 'EXTEND_TRAINING': '拓展练习',
      'REPORT_GENERATING': '生成报告…', 'REPORT_DISPLAY': '训练报告', 'HISTORY': '历史记录'
    };
    this.elements['header-title'].textContent = titles[state] || '英语口语训练';

    const f = document.getElementById('footer-bar');
    const showFooter = ['DIALOGUE_ACTIVE', 'CORRECTING', 'CORRECTION_FEEDBACK', 'EXTEND_TRAINING'].includes(state);
    if (f) f.style.display = showFooter ? 'block' : 'none';
    const main = document.getElementById('main-content');
    if (main) main.style.paddingBottom = showFooter ? '140px' : '20px';
  }

  // --- IDLE ---
  showCompatBadge(mode) {
    const b = this.elements['compat-badge'];
    if (b) {
      const labels = { FULL:'', RECORD_ONLY:'', TEXT_ONLY:'⚠️ 纯文字模式' };
      b.textContent = labels[mode] || '';
    }
  }

  // --- OCR ---
  showOCRPreview(url) {
    const img = document.getElementById('ocr-preview-img');
    const ph = document.querySelector('.ocr-placeholder');
    if (img) { img.src = url; img.style.display = 'block'; }
    if (ph) ph.style.display = 'none';
  }
  showOCRProgress(pct, hint) {
    const f = document.getElementById('ocr-progress-fill');
    const t = document.getElementById('ocr-progress-text');
    const h = document.getElementById('ocr-progress-hint');
    if (f) f.style.width = pct+'%';
    if (t) t.textContent = hint || '正在识别…';
    if (h && pct >= 100) h.textContent = '识别完成！';
  }
  setReviewText(t) { const e = document.getElementById('text-review-editor'); if (e) e.value = t; }
  getReviewText() { const e = document.getElementById('text-review-editor'); return e ? e.value.trim() : ''; }

  // --- Role / Difficulty Select ---
  highlightRole(id) {
    document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
    const c = document.querySelector(`.role-card[data-role="${id}"]`);
    if (c) c.classList.add('selected');
  }
  highlightDifficulty(lv) {
    document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
    const c = document.querySelector(`.diff-card[data-difficulty="${lv}"]`);
    if (c) c.classList.add('selected');
  }

  // --- DIALOGUE_READY ---
  showReadyInfo(passage, role, diff) {
    const p = document.getElementById('ready-passage');
    const r = document.getElementById('ready-role');
    const d = document.getElementById('ready-difficulty');
    if (p) p.textContent = (passage||'').substring(0,40)+(passage?.length>40?'…':'')||'—';
    if (r) r.textContent = role||'—';
    if (d) d.textContent = diff||'—';
  }
  startReadyCountdown(sec, cb) {
    const el = document.getElementById('ready-countdown');
    let c = sec;
    el.textContent = c;
    const t = setInterval(() => {
      c--; if (c<=0) { clearInterval(t); el.textContent='开始！'; setTimeout(cb,500); }
      else el.textContent = c;
    }, 1000);
  }

  // --- DIALOGUE_ACTIVE ---
  clearChat() { if (this.elements['dialogue-chat-area']) this.elements['dialogue-chat-area'].innerHTML = ''; }
  addChatBubble(speaker, text, isUser=false, avatar='') {
    const c = this.elements['dialogue-chat-area']; if (!c) return;
    const b = document.createElement('div');
    b.className = `chat-bubble ${isUser?'user':'ai'}`;
    b.innerHTML = isUser
      ? `<div class="chat-bubble-text">${text}</div>`
      : `<div class="chat-bubble-header">${avatar} ${speaker}</div><div class="chat-bubble-text">${text}</div>`;
    c.appendChild(b); c.scrollTop = c.scrollHeight;
  }
  addInterimBubble(text) {
    const ex = document.querySelector('.chat-bubble.recording'); if (ex) ex.remove();
    const c = this.elements['dialogue-chat-area']; if (!c||!text) return;
    const b = document.createElement('div');
    b.className = 'chat-bubble user recording';
    b.innerHTML = `<div class="chat-bubble-text">${text}…</div>`;
    c.appendChild(b); c.scrollTop = c.scrollHeight;
  }
  removeInterimBubble() { const e = document.querySelector('.chat-bubble.recording'); if (e) e.remove(); }

  // 音频消息气泡（可回放）
  addAudioBubble(audioUrl) {
    const c = this.elements['dialogue-chat-area']; if (!c) return;
    const b = document.createElement('div');
    b.className = 'chat-bubble user audio-bubble';
    const id = 'audio_' + Date.now();
    b.innerHTML = `
      <div class="audio-player">
        <button class="audio-play-btn" data-audio-id="${id}">▶️</button>
        <div class="audio-wave-visual">
          <span class="aw-bar"></span><span class="aw-bar"></span><span class="aw-bar"></span>
          <span class="aw-bar"></span><span class="aw-bar"></span><span class="aw-bar"></span>
          <span class="aw-bar"></span><span class="aw-bar"></span>
        </div>
        <span class="audio-time" id="${id}_time">0:00</span>
        <audio id="${id}" src="${audioUrl}" preload="auto"></audio>
      </div>`;
    c.appendChild(b);

    // 绑定播放/暂停事件
    const audio = document.getElementById(id);
    const btn = b.querySelector('.audio-play-btn');
    const timeEl = document.getElementById(`${id}_time`);
    if (audio && btn) {
      audio.addEventListener('loadedmetadata', () => {
        if (timeEl && audio.duration) {
          timeEl.textContent = Math.floor(audio.duration/60) + ':' + String(Math.floor(audio.duration%60)).padStart(2,'0');
        }
      });
      audio.addEventListener('timeupdate', () => {
        if (timeEl) timeEl.textContent = Math.floor(audio.currentTime/60) + ':' + String(Math.floor(audio.currentTime%60)).padStart(2,'0');
      });
      audio.addEventListener('ended', () => { btn.textContent = '▶️'; });
      btn.addEventListener('click', () => {
        if (audio.paused) { audio.play(); btn.textContent = '⏸'; }
        else { audio.pause(); btn.textContent = '▶️'; }
      });
    }
    c.scrollTop = c.scrollHeight;
  }
  updateProgress(cur, total) { const e = this.elements['dialogue-progress']; if (e) e.textContent = `第 ${cur}/${total} 句`; }
  updateDifficultyBadge(label) { const e = this.elements['dialogue-diff-badge']; if (e) e.textContent = label; }
  showHint(text) {
    const a = this.elements['dialogue-hint-area'];
    const t = this.elements['dialogue-hint-text'];
    if (a && t && text) { a.style.display='block'; t.textContent=text; }
    else if (a) a.style.display='none';
  }

  // --- Footer Input ---
  getTextInput() { const f = this.elements['text-input-field']; return f ? f.value.trim() : ''; }
  clearTextInput() { const f = this.elements['text-input-field']; if (f) f.value = ''; }
  focusTextInput() { const f = this.elements['text-input-field']; if (f) f.focus(); }

  setMicStatus(text, color) {
    const b = this.elements['mic-status-bar'];
    const t = this.elements['mic-status-text'];
    if (b) b.style.display = text ? 'block' : 'none';
    if (t) { t.textContent = text||''; t.style.color = color||'#888'; }
  }

  setMicButtonStyle(style) {
    const b = this.elements['btn-mic']; if (!b) return;
    // 移除旧 class
    b.classList.remove('recording-btn');

    const styles = {
      idle: { background:'#fff', borderColor:'#E8E8E8', color:'#666' },
      listening: { background:'#E8F5E9', borderColor:'#52C41A', color:'#52C41A' },
      recording: { background:'#FFF1F0', borderColor:'#FF4D4F', color:'#FF4D4F' },
      disabled: { background:'#f5f5f5', borderColor:'#ddd', color:'#ccc' }
    };
    const s = styles[style] || styles.idle;
    Object.assign(b.style, s);

    // 录音态加脉冲动画 class
    if (style === 'recording') b.classList.add('recording-btn');
  }

  // --- Correction Feedback ---
  showCorrection(userText, expectedText, errors, isPerfect) {
    const ue = document.getElementById('correction-user-text');
    const ce = document.getElementById('correction-correct-text');
    const ra = document.getElementById('correction-result-area');

    if (ue) {
      if (userText) {
        let h = userText;
        for (const err of errors) {
          if (err.actual && err.actual !== '(遗漏)' && err.actual !== '(无响应)')
            h = h.replace(err.actual, `<span class="correction-error-word">${err.actual}</span>`);
        }
        ue.innerHTML = h;
      } else ue.innerHTML = '<span class="correction-error-word">(无响应)</span>';
    }
    if (ce) ce.textContent = expectedText;

    if (ra) {
      if (isPerfect) {
        ra.innerHTML = '<div class="correction-perfect"><span class="perfect-icon">✅</span><div class="perfect-text">非常完美！</div></div>';
      } else if (errors.length > 0) {
        ra.innerHTML = '<div style="font-size:14px;font-weight:600;margin-bottom:8px;">💡 改进建议：</div>' +
          errors.map(e => {
            const labels = { pronunciation:'🗣 发音', grammar:'📝 语法', vocabulary:'📖 用词', missing:'⚠️ 遗漏' };
            return `<div class="correction-error-item">
              <span class="correction-error-type ${e.type}">${labels[e.type]||'错误'}</span>
              <div class="correction-error-feedback">${e.feedback}</div></div>`;
          }).join('');
      } else ra.innerHTML = '<div style="text-align:center;color:#888;">继续加油！</div>';
    }
    const cd = document.getElementById('correction-countdown');
    if (cd) cd.textContent = '';
  }

  startCorrectionCountdown(sec, cb) {
    const el = document.getElementById('correction-countdown');
    if (!el) return null;
    let c = sec;
    el.textContent = `${c} 秒后自动重试…`;
    const t = setInterval(() => {
      c--; if (c<=0) { clearInterval(t); el.textContent=''; cb(); }
      else el.textContent = `${c} 秒后自动重试…`;
    }, 1000);
    return t;
  }

  // --- Extend Training ---
  showExtendExercise(ex) {
    const badge = document.getElementById('extend-phase-badge');
    const prompt = document.getElementById('extend-prompt-text');
    const orig = document.getElementById('extend-original-text');
    const newT = document.getElementById('extend-new-text');
    const opts = document.getElementById('extend-options-area');
    if (badge) badge.textContent = ex.phaseLabel || `阶段 ${ex.phase}/2`;
    if (prompt) prompt.textContent = ex.prompt || '换个词试试吧！';
    if (orig) orig.textContent = ex.original;
    if (newT) newT.innerHTML = ex.template.replace('________', '<span style="color:#4A90D9;font-weight:700;">?</span>');
    if (opts && ex.alternatives) {
      opts.innerHTML = ex.alternatives.map(w => `<div class="extend-option" data-word="${w}">${w}</div>`).join('');
    }
  }
  highlightExtendOption(w) {
    document.querySelectorAll('.extend-option').forEach(o => o.classList.remove('selected'));
    const o = document.querySelector(`.extend-option[data-word="${w}"]`);
    if (o) o.classList.add('selected');
  }

  // --- Pronunciation Feedback ---
  showPronunciationFeedback(report, expectedText) {
    // 总分
    const scoreEl = document.getElementById('pron-overall-score');
    const starsEl = document.getElementById('pron-overall-stars');
    if (scoreEl) scoreEl.textContent = report.overall;
    if (starsEl) starsEl.textContent = report.stars;

    // 四个维度
    this._setPronDim('accuracy', report.accuracy);
    this._setPronDim('fluency', report.fluency);
    this._setPronDim('completeness', report.completeness);
    this._setPronDim('intonation', report.intonation);

    // 详细反馈
    const detailEl = document.getElementById('pron-detail');
    if (detailEl) {
      const parts = [];
      if (report.accuracy.detail) parts.push(`<div class="pron-detail-item">🎯 ${report.accuracy.detail}</div>`);
      if (report.fluency.detail) parts.push(`<div class="pron-detail-item">💨 ${report.fluency.detail}</div>`);
      if (report.completeness.detail) parts.push(`<div class="pron-detail-item">📋 ${report.completeness.detail}</div>`);
      if (report.intonation.detail) parts.push(`<div class="pron-detail-item">🎵 ${report.intonation.detail}</div>`);
      if (expectedText) parts.push(`<div class="pron-detail-item" style="margin-top:8px;color:#4A90D9;">📝 正确句子：${expectedText}</div>`);
      if (report.suggestions && report.suggestions.length > 0) {
        parts.push(`<div style="margin-top:8px;font-weight:600;color:#D46B08;">💡 改进建议：</div>`);
        report.suggestions.forEach(s => {
          parts.push(`<div class="pron-detail-suggestion">• ${s}</div>`);
        });
      }
      detailEl.innerHTML = parts.join('');
    }

    // 倒计时重置
    const cdEl = document.getElementById('correction-countdown');
    if (cdEl) cdEl.textContent = '';
  }

  _setPronDim(name, dim) {
    const fillEl = document.getElementById(`pron-fill-${name}`);
    const scoreEl = document.getElementById(`pron-score-${name}`);
    const s = dim.score || 0;
    if (fillEl) {
      fillEl.style.width = s + '%';
      fillEl.className = 'pron-dim-fill ' + (s >= 80 ? 'high' : s >= 50 ? 'medium' : 'low');
    }
    if (scoreEl) scoreEl.textContent = s;
  }

  // --- Report ---
  showReport(report) {
    const body = document.getElementById('report-body'); if (!body) return;
    const stars = s => s>=90?'⭐⭐⭐⭐⭐':s>=75?'⭐⭐⭐⭐':s>=60?'⭐⭐⭐':s>=40?'⭐⭐':'⭐';
    body.innerHTML = `
      <div class="report-score"><div class="report-score-big">${report.overallScore}</div><div class="report-score-label">综合评分 / 100</div></div>
      <div class="report-card"><div class="report-card-title">📊 训练概览</div>
        <div class="report-stats-grid">
          <div class="report-stat-item"><div class="report-stat-value">${report.stats.totalTurns}</div><div class="report-stat-label">总句数</div></div>
          <div class="report-stat-item"><div class="report-stat-value">${report.stats.goodTurns}</div><div class="report-stat-label">正确句</div></div>
          <div class="report-stat-item"><div class="report-stat-value">${report.stats.okTurns+report.stats.badTurns}</div><div class="report-stat-label">需改进</div></div>
          <div class="report-stat-item"><div class="report-stat-value">${report.duration}s</div><div class="report-stat-label">训练时长</div></div>
        </div></div>
      <div class="report-card"><div class="report-card-title">📈 能力评分</div>
        <div class="report-dimension"><span>🗣 发音</span><span>${stars(report.pronunciationScore)} ${report.pronunciationScore}</span></div>
        <div class="report-dimension"><span>📝 语法</span><span>${stars(report.grammarScore)} ${report.grammarScore}</span></div>
        <div class="report-dimension"><span>📖 词汇</span><span>${stars(report.vocabularyScore)} ${report.vocabularyScore}</span></div>
        <div class="report-dimension"><span>💨 流畅度</span><span>${stars(report.fluencyScore)} ${report.fluencyScore}</span></div></div>
      <div class="report-card">
        <div class="report-collapse-header" onclick="
          const btn=this.querySelector('.report-collapse-arrow');
          const body=this.nextElementSibling;
          btn.classList.toggle('open');
          body.classList.toggle('open');
        ">
          <div class="report-card-title">📋 逐句记录 (${report.turns.length}句)</div>
          <span class="report-collapse-arrow" style="font-size:14px;">▶</span>
        </div>
        <div class="report-collapse-body">
        ${report.turns.map((t,i)=>{
          const cls=t.score>=80?'good':(t.score>=60?'ok':'bad');
          const icon=t.score>=80?'✅':(t.score>=60?'⚠️':'❌');
          return `<div class="report-turn-item"><div class="report-turn-header"><span class="report-turn-num">句${i+1}</span><span class="report-turn-score ${cls}">${icon} ${t.score||0}分</span></div><div class="report-turn-text">原文: ${t.originalText}</div><div class="report-turn-text">你说: ${t.userInput}</div></div>`;
        }).join('')}
        </div>
      </div>
      ${report.weakPoints.length>0?`<div class="report-card"><div class="report-card-title">🎯 薄弱环节</div>${report.weakPoints.map(w=>`<div class="report-weak-item"><div class="report-weak-category">${w.description}</div><div class="report-weak-count">出现 ${w.count} 次</div></div>`).join('')}</div>`:''}
      ${report.progressTrend.improved?`<div class="report-card" style="background:#F6FFED;border:1px solid #52C41A;"><div class="report-card-title">📈 进步趋势</div><div style="font-size:14px;">前半段:${report.progressTrend.firstHalfAccuracy}% → 后半段:${report.progressTrend.secondHalfAccuracy}%</div><div style="color:#52C41A;font-weight:600;">👍 有明显进步！</div></div>`:''}
      <div class="report-card"><div class="report-card-title">💪 建议练习</div>${report.recommendedExercises.map(r=>`<div class="report-rec-item">${r}</div>`).join('')}</div>`;
  }

  // --- History ---
  showHistory(reports) {
    const l = document.getElementById('history-list'); if (!l) return;
    if (!reports||!reports.length) { l.innerHTML='<p class="history-empty">暂无训练记录</p>'; return; }
    l.innerHTML = reports.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(r=>{
      const d = new Date(r.date).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
      return `<div class="history-item" data-report-id="${r.id}"><div class="history-item-date">${d}</div><div class="history-item-score">${r.overallScore} 分</div><div class="history-item-text">${(r.originalPassage||'').substring(0,30)}…</div></div>`;
    }).join('');
  }
}
