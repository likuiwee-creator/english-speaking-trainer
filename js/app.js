// app.js - 应用入口 & 核心编排
import { CONFIG, ROLES } from './config.js';
import { StateMachine } from './stateMachine.js';
import { SpeechEngine } from './speechEngine.js';
import { OCREngine } from './ocrEngine.js';
import { CorrectionEngine } from './correctionEngine.js';
import { DifficultyController } from './difficultyController.js';
import { DialogueManager } from './dialogueManager.js';
import { ExtendTraining } from './extendTraining.js';
import { TrainingRecorder } from './trainingRecorder.js';
import { StorageManager } from './storageManager.js';
import { UIRenderer } from './uiRenderer.js';
import { PronunciationAnalyzer } from './pronunciationAnalyzer.js';

class App {
  constructor() {
    // 初始化所有模块
    this.stateMachine = new StateMachine();
    this.speech = new SpeechEngine();
    this.ocr = new OCREngine();
    this.correction = new CorrectionEngine();
    this.difficultyCtrl = new DifficultyController('medium');
    this.extendTraining = new ExtendTraining();
    this.storage = new StorageManager();
    this.ui = new UIRenderer();
    this.pronAnalyzer = new PronunciationAnalyzer();

    // 运行时状态
    this.dialogue = null;
    this.recorder = null;
    this.currentAudioBlob = null;    // 当前录音
    this._recordingPromise = null;
    this._recordingActive = false;
    this._lastAudioUrl = null;
    this._currentExpectedText = '';
    this.selectedRole = null;
    this.selectedRoleId = null;
    this.originalPassage = '';
    this.correctionTimer = null;
    this.countdownTimer = null;
    this.isExtendPhase = false;
    this.extendSelectedWord = null;
    this.pendingExtendExercise = null;
  }

  // ========== 启动 ==========
  async init() {
    // 初始化存储
    await this.storage.init();

    // 显示兼容模式
    const mode = this.speech.getFallbackMode();
    this.ui.showCompatBadge(mode);

    // 如果是纯文字模式，调整 UI
    if (mode === 'TEXT_ONLY' || mode === 'TEXT_INPUT') {
      // 不自动显示文本输入，而是给用户选择
    }
    console.log('[App] Speech mode:', mode, 'Recognition:', this.speech.supportsRecognition, 'Synthesis:', this.speech.supportsSynthesis);

    // 状态机监听
    this.stateMachine.onChange((event) => this._onStateChange(event));

    // 绑定事件
    this._bindEvents();

    // 初始状态
    this.ui.showState('IDLE');
  }

  // ========== 事件绑定 ==========
  _bindEvents() {
    // 开始训练
    document.getElementById('btn-start-training')?.addEventListener('click', () => {
      this.stateMachine.transition('OCR_CAPTURING');
    });

    // 手动输入课文
    document.getElementById('btn-text-input')?.addEventListener('click', () => {
      this.ui.setReviewText('');
      this.stateMachine.transition('TEXT_INPUT');
    });

    // 拍照
    document.getElementById('btn-capture')?.addEventListener('click', () => {
      document.getElementById('ocr-file-input').click();
    });

    // 相册选择
    document.getElementById('btn-gallery')?.addEventListener('click', () => {
      const input = document.getElementById('ocr-file-input');
      input.removeAttribute('capture');
      input.click();
      input.setAttribute('capture', 'environment');
    });

    // 文件选择
    document.getElementById('ocr-file-input')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this._processOCR(file);
    });

    // 确认文本
    document.getElementById('btn-confirm-text')?.addEventListener('click', () => {
      this.originalPassage = this.ui.getReviewText();
      if (!this.originalPassage) {
        alert('请输入或识别课文内容');
        return;
      }
      this.stateMachine.transition('ROLE_SELECT');
    });

    // 角色选择
    document.querySelectorAll('.role-card').forEach(card => {
      card.addEventListener('click', () => {
        this.selectedRoleId = card.dataset.role;
        this.selectedRole = ROLES[this.selectedRoleId];
        this.ui.highlightRole(this.selectedRoleId);
        setTimeout(() => {
          this.stateMachine.transition('DIFFICULTY_SELECT');
        }, 300);
      });
    });

    // 难度选择
    document.querySelectorAll('.diff-card').forEach(card => {
      card.addEventListener('click', () => {
        const level = card.dataset.difficulty;
        this.difficultyCtrl.setLevel(level);
        this.ui.highlightDifficulty(level);
        setTimeout(() => {
          this.stateMachine.transition('DIALOGUE_READY');
        }, 300);
      });
    });

    // 纠错 - 听示范发音
    document.getElementById('btn-listen-demo')?.addEventListener('click', () => {
      const text = this._currentExpectedText;
      if (text) {
        this.ui.setMicButtonStyle('disabled');
        this.speech.speak(text).then(() => {
          this.ui.setMicButtonStyle('idle');
        });
      }
    });

    // 纠错 - 再来一次
    document.getElementById('btn-retry-sentence')?.addEventListener('click', () => {
      this._clearTimers();
      this.stateMachine.transition('DIALOGUE_ACTIVE');
      this._nextDialogueTurn();
    });

    // 跳过此句
    document.getElementById('btn-skip-turn')?.addEventListener('click', () => {
      this._skipTurn();
    });

    // 麦克风按钮（长按录音，松手停止 — 微信式交互）
    const micBtn = document.getElementById('btn-mic');
    if (micBtn) {
      this._recordingActive = false;
      const startRecord = (e) => {
        e.preventDefault();
        if (!this._recordingActive) {
          this._recordingActive = true;
          this._startRecording();
        }
      };
      const stopRecord = (e) => {
        e.preventDefault();
        if (this._recordingActive) {
          this._recordingActive = false;
          this._stopRecording();
        }
      };
      micBtn.addEventListener('mousedown', startRecord);
      micBtn.addEventListener('touchstart', startRecord, { passive: false });
      micBtn.addEventListener('mouseup', stopRecord);
      micBtn.addEventListener('touchend', stopRecord);
      micBtn.addEventListener('touchcancel', stopRecord);
    }

    // 文本输入提交
    document.getElementById('btn-text-submit')?.addEventListener('click', () => {
      const text = this.ui.getTextInput();
      if (text.trim()) {
        this._handleUserInput(text);
        this.ui.clearTextInput();
      }
    });

    // 文本输入回车
    document.getElementById('text-input-field')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const text = this.ui.getTextInput();
        if (text.trim()) {
          this._handleUserInput(text);
          this.ui.clearTextInput();
        }
      }
    });

    // 重新训练
    document.getElementById('btn-restart')?.addEventListener('click', () => {
      this._reset();
      this.stateMachine.reset();
      this.ui.showState('IDLE');
    });

    // 历史记录
    document.getElementById('btn-history')?.addEventListener('click', () => {
      this._showHistory();
    });
    document.getElementById('btn-history-back')?.addEventListener('click', () => {
      this._showHistory();
    });

    // 返回按钮
    document.querySelectorAll('.btn-back').forEach(btn => {
      btn.addEventListener('click', () => {
        const back = btn.dataset.back;
        if (back === 'idle') {
          this._reset();
          this.stateMachine.reset();
          this.ui.showState('IDLE');
        } else if (back === 'ocr-capturing') {
          this.stateMachine.transition('OCR_CAPTURING');
        }
      });
    });

    // 历史记录项点击
    document.getElementById('history-list')?.addEventListener('click', (e) => {
      const item = e.target.closest('.history-item');
      if (item) {
        this._viewReport(item.dataset.reportId);
      }
    });

    // 拓展选项点击
    document.getElementById('extend-options-area')?.addEventListener('click', (e) => {
      const opt = e.target.closest('.extend-option');
      if (opt) {
        this.extendSelectedWord = opt.dataset.word;
        this.ui.highlightExtendOption(this.extendSelectedWord);
        this._doExtendPractice();
      }
    });
  }

  // ========== 状态变更处理 ==========
  _onStateChange(event) {
    console.log(`State: ${event.from} → ${event.to}`);

    switch (event.to) {
      case 'IDLE':
        this.ui.showState('IDLE');
        break;
      case 'OCR_CAPTURING':
        this.ui.showState('OCR_CAPTURING');
        break;
      case 'OCR_PROCESSING':
        this.ui.showState('OCR_PROCESSING');
        break;
      case 'TEXT_REVIEW':
        this.ui.showState('TEXT_REVIEW');
        break;
      case 'ROLE_SELECT':
        this.ui.showState('ROLE_SELECT');
        break;
      case 'DIFFICULTY_SELECT':
        this.ui.showState('DIFFICULTY_SELECT');
        break;
      case 'DIALOGUE_READY':
        this._onDialogueReady();
        break;
      case 'DIALOGUE_ACTIVE':
        this.ui.showState('DIALOGUE_ACTIVE');
        break;
      case 'CORRECTING':
        this.ui.showState('CORRECTING');
        break;
      case 'CORRECTION_FEEDBACK':
        this.ui.showState('CORRECTION_FEEDBACK');
        break;
      case 'EXTEND_TRAINING':
        this.ui.showState('EXTEND_TRAINING');
        this._startExtendTraining();
        break;
      case 'REPORT_GENERATING':
        this.ui.showState('REPORT_GENERATING');
        this._generateReport();
        break;
      case 'REPORT_DISPLAY':
        this.ui.showState('REPORT_DISPLAY');
        break;
      case 'HISTORY':
        this._showHistory();
        break;
      case 'TEXT_INPUT':
        this.ui.showState('TEXT_REVIEW');
        break;
    }
  }

  // ========== OCR 处理 ==========
  async _processOCR(file) {
    // 预览
    const reader = new FileReader();
    reader.onload = (e) => this.ui.showOCRPreview(e.target.result);
    reader.readAsDataURL(file);

    // 进入处理状态
    this.stateMachine.transition('OCR_PROCESSING');

    try {
      const result = await this.ocr.processImage(file, (progress) => {
        this.ui.showOCRProgress(progress.pct, progress.hint);
      });

      this.originalPassage = result.cleanedText;
      this.ui.setReviewText(result.cleanedText);
      this.stateMachine.transition('TEXT_REVIEW');
    } catch (error) {
      console.error('OCR error:', error);
      alert('OCR 识别失败: ' + error.message + '\n请手动输入课文内容');
      this.ui.setReviewText('');
      this.stateMachine.transition('TEXT_REVIEW');
    }
  }

  // ========== 对话准备 ==========
  _onDialogueReady() {
    this.ui.showState('DIALOGUE_READY');

    // 确定 AI 角色（用户不选的角色）
    let aiRoleId = 'student_b';
    if (this.selectedRoleId === 'student_b') aiRoleId = 'student_a';
    else if (this.selectedRoleId === 'teacher') aiRoleId = 'student_a';

    const aiRole = ROLES[aiRoleId];

    // 显示准备信息
    this.ui.showReadyInfo(
      this.originalPassage,
      this.selectedRole.name,
      this.difficultyCtrl.getLabel()
    );

    // 初始化对话管理器
    this.dialogue = new DialogueManager(
      this.originalPassage,
      this.selectedRoleId,
      aiRoleId,
      this.difficultyCtrl.getLevel()
    );

    // 初始化训练记录器
    this.recorder = new TrainingRecorder(this.dialogue, this.difficultyCtrl);

    // 倒计时 3-2-1 开始
    this.ui.startReadyCountdown(CONFIG.training.readyCountdown, () => {
      this.stateMachine.transition('DIALOGUE_ACTIVE');
      this._nextDialogueTurn();
    });
  }

  // ========== 对话循环 ==========
  async _nextDialogueTurn() {
    if (!this.dialogue) return;

    // 检查是否完成所有句子
    if (!this.dialogue.hasNextTurn()) {
      // 检查是否需要拓展训练
      if (!this.isExtendPhase && this.dialogue.getTotalSentences() >= CONFIG.training.minTurnsForExtend) {
        this.isExtendPhase = true;
        this.stateMachine.transition('EXTEND_TRAINING');
        return;
      }
      // 生成报告
      this.stateMachine.transition('REPORT_GENERATING');
      return;
    }

    // 生成下一轮
    const turn = this.dialogue.generateNextTurn();
    if (!turn) {
      this.stateMachine.transition('REPORT_GENERATING');
      return;
    }

    // 更新进度
    const progress = this.dialogue.getProgress();
    this.ui.updateProgress(progress.current, progress.total);
    this.ui.updateDifficultyBadge(this.difficultyCtrl.getLabel());

    // 清除聊天区域（可选：保留历史）
    // this.ui.clearChat();

    // 如果是 AI 回合
    if (!turn.isUserTurn && turn.aiPrompt) {
      // AI 先说话
      const aiRole = ROLES[turn.speakerRole];
      this.ui.addChatBubble(
        turn.speakerName,
        turn.aiPrompt.text,
        false,
        aiRole?.avatar || ''
      );

      // 根据难度决定是否显示提示
      if (this.difficultyCtrl.getLevel() !== 'hard') {
        const nextUserSentence = this.dialogue.getUserSentence(this.dialogue.currentTurnIndex + 1);
        this.ui.showHint(nextUserSentence);
      } else {
        this.ui.showHint(null);
      }

      // 更新底部状态
      this.ui.setMicButtonStyle('disabled');

      // TTS 播放 AI 的话
      const voiceOpts = ROLES[turn.speakerRole]?.voice || {};
      await this.speech.speak(turn.aiPrompt.text, voiceOpts);
    }

    // 用户回合开始 — 显示输入界面
    this._startUserTurn(turn);
  }

  _startUserTurn(turn) {
    // 文字输入始终可用，清空并聚焦
    this.ui.clearTextInput();
    this.ui.focusTextInput();
    this.ui.setMicButtonStyle('idle');
    this.ui.setMicStatus('', '#888');

    console.log('[App] turn ready, mode:', this.speech.getFallbackMode());
  }

  // 开始录音（长按触发）
  async _startRecording() {
    if (this.speech.isRecording) return;
    console.log('[App] start recording...');
    this.ui.setMicButtonStyle('recording');
    this.ui.setMicStatus('🔴 正在录音，松手停止', '#FF4D4F');

    try {
      this._recordingPromise = this.speech.startRecording();
    } catch (e) {
      console.warn('[App] Recording start failed:', e.message);
      this.ui.setMicButtonStyle('idle');
      this.ui.setMicStatus('录音失败: ' + (e.message?.includes('Permission') ? '麦克风权限被拒绝' : e.message), '#FF4D4F');
    }
  }

  // 停止录音并分析（松手触发）
  async _stopRecording() {
    if (!this.speech || !this.speech.isRecording) return;
    if (!this._recordingPromise) return;
    console.log('[App] stop recording...');
    this.speech.stopRecording();
    this._recordingActive = false;
    this.ui.setMicButtonStyle('idle');
    this.ui.setMicStatus('正在评价发音…', '#4A90D9');

    try {
      const result = await this._recordingPromise;
      this._recordingPromise = null;
      if (!result || !result.blob || result.blob.size < 100) {
        this.ui.setMicStatus('录音太短（< 0.5秒），请重新录制', '#FF4D4F');
        return;
      }

      // 生成可播放的音频 URL
      const audioUrl = URL.createObjectURL(result.blob);
      this._lastAudioUrl = audioUrl;

      // 在聊天区显示音频气泡
      this.ui.addAudioBubble(audioUrl);

      // 分析发音
      const turn = this.dialogue?.getCurrentTurn();
      const expectedText = turn?.originalText || '';
      this._currentExpectedText = expectedText;
      const pronReport = await this.pronAnalyzer.analyze(
        result.blob,
        expectedText,
        ''
      );

      console.log('[App] Pronunciation report:', pronReport);

      // 显示评价
      this.stateMachine.transition('CORRECTION_FEEDBACK');
      this.ui.showPronunciationFeedback(pronReport, expectedText);

      // 记录
      if (turn) {
        this.dialogue.recordUserInput(turn.id, '(语音)', { overallScore: pronReport.overall, errors: [] });
        this.recorder?.logTurn({ ...turn, userInput: '(语音)', score: pronReport.overall });
      }

      // 自动倒计时
      this.countdownTimer = this.ui.startCorrectionCountdown(
        CONFIG.training.repeatCountdown,
        () => {
          this.stateMachine.transition('DIALOGUE_ACTIVE');
          this._nextDialogueTurn();
        }
      );
    } catch (e) {
      console.warn('[App] Recording stop error:', e.message);
      this.ui.setMicStatus('处理出错，请重试', '#FF4D4F');
      this.ui.focusTextInput();
    }
  }

  _handleUserInput(text) {
    if (!this.dialogue) return;

    const turn = this.dialogue.getCurrentTurn();
    if (!turn) return;

    // 添加用户气泡
    this.ui.addChatBubble('你', text, true, '');
    this.ui.clearTextInput();
    this.ui.setMicButtonStyle('idle');
    this.ui.setMicStatus('', '#888');

    // 进入纠错分析
    this.stateMachine.transition('CORRECTING');

    // 短暂延迟模拟分析
    setTimeout(() => {
      this._doCorrection(turn, text);
    }, 800);
  }

  _skipTurn() {
    this._clearTimers();
    this.speech.stopAll();
    this._recordingActive = false;
    this._recordingPromise = null;

    const turn = this.dialogue?.getCurrentTurn();
    if (turn) {
      this.dialogue.recordUserInput(turn.id, '(跳过)', { overallScore: 50, errors: [] });
      this.recorder?.logTurn({ ...turn, userInput: '(跳过)', score: 50 });
    }

    this.ui.setMicButtonStyle('idle');
    this.ui.setMicStatus('', '#888');
    this.stateMachine.transition('DIALOGUE_ACTIVE');
    this._nextDialogueTurn();
  }

  // ========== 纠错处理（文字输入） ==========
  _doCorrection(turn, userText) {
    const correction = this.correction.analyze(
      userText,
      turn.originalText,
      this.difficultyCtrl.getLevel(),
      turn.id
    );

    // 记录
    this.dialogue.recordUserInput(turn.id, userText, correction);
    this.recorder.logTurn({ ...turn, userInput: userText, correction, score: correction.overallScore });
    this._currentExpectedText = turn.originalText;

    // 检查是否已纠错过（每个对话单元仅纠错1次）
    if (correction.isPerfect) {
      this.stateMachine.transition('DIALOGUE_ACTIVE');
      setTimeout(() => this._nextDialogueTurn(), 500);
      return;
    }

    if (turn.isCorrected) {
      this.stateMachine.transition('DIALOGUE_ACTIVE');
      setTimeout(() => this._nextDialogueTurn(), 300);
      return;
    }

    // 首次错误，用发音评价格式展示
    this.dialogue.markCorrected(turn.id);

    // 将 CorrectionEngine 结果转为发音评价报告格式
    const pronReport = {
      overall: correction.overallScore,
      stars: correction.overallScore >= 90 ? '⭐⭐⭐⭐⭐' : correction.overallScore >= 75 ? '⭐⭐⭐⭐' : correction.overallScore >= 60 ? '⭐⭐⭐' : correction.overallScore >= 40 ? '⭐⭐' : '⭐',
      accuracy: { score: correction.pronunciationScore || correction.overallScore, label: '音准', detail: userText ? `你说的是 "${userText.substring(0,30)}"` : '未检测到输入' },
      fluency: { score: correction.fluencyScore || 70, label: '流畅度', detail: '' },
      completeness: { score: correction.vocabularyScore || correction.overallScore, label: '完整度', detail: '' },
      intonation: { score: 70, label: '语调', detail: '文字模式下语调仅供参考' },
      suggestions: correction.errors.map(e => e.feedback).slice(0, 5)
    };

    this.stateMachine.transition('CORRECTION_FEEDBACK');
    this.ui.showPronunciationFeedback(pronReport, turn.originalText);

    // 评估难度
    const allTurns = this.dialogue.getAllTurns().map(t => ({
      userInput: t.userInput, score: t.score || 0, correction: t.correction
    }));
    this.difficultyCtrl.evaluate(allTurns);
    this.ui.updateDifficultyBadge(this.difficultyCtrl.getLabel());

    // 自动倒计时重试
    this.countdownTimer = this.ui.startCorrectionCountdown(
      CONFIG.training.repeatCountdown,
      () => {
        this.stateMachine.transition('DIALOGUE_ACTIVE');
        this._nextDialogueTurn();
      }
    );
  }

  // ========== 拓展训练 ==========
  _startExtendTraining() {
    const allTurns = this.dialogue.getAllTurns();
    const correctSentences = allTurns
      .filter(t => t.score !== null && t.score >= CONFIG.scoring.goodThreshold)
      .map(t => t.originalText);

    this.extendTraining.start();
    const exercise = this.extendTraining.getNextExercise(correctSentences);

    if (!exercise) {
      // 没有合适的拓展练习，直接生成报告
      this.stateMachine.transition('REPORT_GENERATING');
      return;
    }

    this.pendingExtendExercise = exercise;
    this.ui.showExtendExercise(exercise);
    this.ui.setMicButtonStyle('listening');
  }

  async _doExtendPractice() {
    if (!this.pendingExtendExercise || !this.extendSelectedWord) return;

    const exercise = this.pendingExtendExercise;
    const newSentence = exercise.original.replace(
      new RegExp(exercise.targetWord || exercise.originalSubject, 'gi'),
      this.extendSelectedWord
    );

    // 播放新句子
    this.ui.setMicButtonStyle('disabled');
    this.ui.addChatBubble('AI 教练', newSentence, false, '🤖');
    await this.speech.speak(newSentence);

    // 记录拓展练习
    this.recorder?.logExtendExercise(exercise);

    // 检查下一阶段
    if (this.extendTraining.phase === 1) {
      this.extendTraining.nextPhase();
      // 获取阶段2练习
      const allTurns = this.dialogue.getAllTurns();
      const correctSentences = allTurns
        .filter(t => t.score !== null && t.score >= CONFIG.scoring.goodThreshold)
        .map(t => t.originalText);
      const nextExercise = this.extendTraining.getNextExercise(correctSentences);

      if (nextExercise) {
        this.pendingExtendExercise = nextExercise;
        this.extendSelectedWord = null;
        this.ui.showExtendExercise(nextExercise);
        this.ui.setMicButtonStyle('listening');
        return;
      }
    }

    // 拓展训练完成
    this.stateMachine.transition('REPORT_GENERATING');
  }

  // ========== 报告生成 ==========
  async _generateReport() {
    if (!this.recorder) return;

    const roleName = this.selectedRole?.name || '学生';
    const report = this.recorder.generateReport(roleName, this.originalPassage);

    // 保存到存储
    try {
      await this.storage.saveReport(report);
    } catch (e) {
      console.warn('Report save error:', e);
    }

    // 显示报告
    this.ui.showReport(report);

    setTimeout(() => {
      this.stateMachine.transition('REPORT_DISPLAY');
    }, 800);
  }

  // ========== 历史记录 ==========
  async _showHistory() {
    this.ui.showState('HISTORY');
    const reports = await this.storage.getReports();
    this.ui.showHistory(reports);
  }

  async _viewReport(reportId) {
    const reports = await this.storage.getReports();
    const report = reports.find(r => r.id === reportId);
    if (report) {
      this.ui.showReport(report);
      this.ui.showState('REPORT_DISPLAY');
    }
  }

  // ========== 工具方法 ==========
  _clearTimers() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.correctionTimer) {
      clearTimeout(this.correctionTimer);
      this.correctionTimer = null;
    }
    this.speech.stopListening();
  }

  _reset() {
    this._clearTimers();
    this.dialogue = null;
    this.recorder = null;
    this.selectedRole = null;
    this.selectedRoleId = null;
    this.originalPassage = '';
    this.isExtendPhase = false;
    this.extendSelectedWord = null;
    this.pendingExtendExercise = null;
    this.extendTraining = new ExtendTraining();
    this.difficultyCtrl = new DifficultyController('medium');
    this.speech.stopAll();
    this.ui.setMicButtonStyle('idle');
    this.ui.setMicStatus('', '#888');
    this.ui.clearChat();
  }
}

// 启动应用
const app = new App();
app.init();
