// stateMachine.js - 对话状态机核心
export class StateMachine {
  constructor() {
    this.current = 'IDLE';
    this.previous = null;
    this.history = [];
    this.transitions = {
      IDLE:               ['OCR_CAPTURING', 'TEXT_INPUT', 'HISTORY'],
      OCR_CAPTURING:      ['OCR_PROCESSING', 'IDLE'],
      OCR_PROCESSING:     ['TEXT_REVIEW', 'OCR_CAPTURING'],
      TEXT_REVIEW:        ['ROLE_SELECT', 'OCR_CAPTURING'],
      ROLE_SELECT:        ['DIFFICULTY_SELECT'],
      DIFFICULTY_SELECT:  ['DIALOGUE_READY'],
      DIALOGUE_READY:     ['DIALOGUE_ACTIVE'],
      DIALOGUE_ACTIVE:    ['CORRECTING', 'EXTEND_TRAINING', 'REPORT_GENERATING'],
      CORRECTING:         ['CORRECTION_FEEDBACK', 'DIALOGUE_ACTIVE'],
      CORRECTION_FEEDBACK: ['DIALOGUE_ACTIVE', 'EXTEND_TRAINING', 'REPORT_GENERATING'],
      EXTEND_TRAINING:    ['DIALOGUE_ACTIVE', 'REPORT_GENERATING'],
      REPORT_GENERATING:  ['REPORT_DISPLAY'],
      REPORT_DISPLAY:     ['IDLE', 'HISTORY'],
      TEXT_INPUT:         ['ROLE_SELECT', 'IDLE'],
      HISTORY:            ['IDLE', 'REPORT_DISPLAY']
    };
    this.listeners = [];
  }

  // 状态变更监听
  onChange(fn) {
    this.listeners.push(fn);
  }

  // 检查是否允许转换
  canTransition(to) {
    const allowed = this.transitions[this.current];
    return allowed && allowed.includes(to);
  }

  // 执行状态转换
  transition(to, data = null) {
    if (!this.canTransition(to)) {
      console.warn(`Invalid transition: ${this.current} → ${to}`);
      return false;
    }

    this.previous = this.current;
    this.history.push({ from: this.current, to, timestamp: Date.now() });
    this.current = to;

    // 通知所有监听器
    const event = { from: this.previous, to, data, timestamp: Date.now() };
    this.listeners.forEach(fn => {
      try { fn(event); } catch (e) { console.error('State listener error:', e); }
    });

    return true;
  }

  // 重置
  reset() {
    this.current = 'IDLE';
    this.previous = null;
    this.history = [];
  }

  // 获取状态名
  getName() {
    return this.current;
  }

  // 是否为活跃对话状态
  isDialogueActive() {
    return ['DIALOGUE_ACTIVE', 'CORRECTING', 'CORRECTION_FEEDBACK'].includes(this.current);
  }
}
