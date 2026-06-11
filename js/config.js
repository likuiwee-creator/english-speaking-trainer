// config.js - 全局配置常量
export const CONFIG = {
  // 语音识别
  speech: {
    lang: 'en-US',
    continuous: false,
    interimResults: true,
    maxAlternatives: 3,
    silenceTimeout: 3000        // 静默超时 ms (onspeechstart 后无结果则超时)
  },

  // TTS 语音合成
  tts: {
    lang: 'en-US',
    defaultRate: 0.9,
    defaultPitch: 1.0,
    volume: 1.0
  },

  // 角色 TTS 参数
  roleVoices: {
    student_a: { rate: 0.9, pitch: 1.2 },
    student_b: { rate: 0.95, pitch: 1.1 },
    teacher: { rate: 0.8, pitch: 0.9 }
  },

  // 难度参数
  difficulty: {
    easy: {
      name: '简易',
      label: '🌟',
      sentenceLength: { max: 5 },
      speechTimeout: 8000,
      responseDelay: 500,
      correctionThreshold: {
        consecutiveErrors: 2,
        silenceTimeout: 5000,
        errorRate: 0.4
      }
    },
    medium: {
      name: '中等',
      label: '🌟🌟',
      sentenceLength: { max: 10 },
      speechTimeout: 6000,
      responseDelay: 300,
      correctionThreshold: {
        consecutiveErrors: 3,
        silenceTimeout: 4000,
        errorRate: 0.3
      }
    },
    hard: {
      name: '困难',
      label: '🌟🌟🌟',
      sentenceLength: { max: 20 },
      speechTimeout: 5000,
      responseDelay: 200,
      correctionThreshold: {
        consecutiveErrors: 4,
        silenceTimeout: 3000,
        errorRate: 0.25
      }
    }
  },

  // 纠错评分权重
  scoring: {
    pronunciationWeight: 0.35,
    grammarWeight: 0.30,
    vocabularyWeight: 0.20,
    fluencyWeight: 0.15,
    criticalPenalty: 15,
    majorPenalty: 8,
    minorPenalty: 3,
    goodThreshold: 80,
    okThreshold: 60
  },

  // 训练控制
  training: {
    feedbackDisplayTime: 4000,   // 纠错展示时间 ms
    countdownInterval: 1000,    // 倒计时间隔 ms
    readyCountdown: 3,          // 准备页倒计时秒数
    repeatCountdown: 3,         // 纠错后重试倒计时秒数
    maxTurnsPerSession: 20,     // 单次最大句数
    minTurnsForExtend: 3,       // 至少需完成多少句才能拓展
    upgradeStreak: 3,           // 连对多少句可以升级
    downgradeErrors: 2          // 连续几个错误降级
  },

  // OCR
  ocr: {
    targetWidth: 1500,
    binarizeThreshold: 128,
    contrastFactor: 1.5,
    language: 'eng',
    pageSegMode: '6'
  },

  // 存储
  storage: {
    dbName: 'EnglishTrainingDB',
    dbVersion: 1
  }
};

// 角色定义
export const ROLES = {
  student_a: {
    id: 'student_a',
    name: '学生 A',
    avatar: '👦',
    voice: { rate: 0.9, pitch: 1.2 }
  },
  student_b: {
    id: 'student_b',
    name: '学生 B',
    avatar: '👧',
    voice: { rate: 0.95, pitch: 1.1 }
  },
  teacher: {
    id: 'teacher',
    name: '老师',
    avatar: '👩‍🏫',
    voice: { rate: 0.8, pitch: 0.9 }
  }
};

// AI 提示语库
export const PROMPTS = {
  easy: {
    correct: ['太好了！', '非常棒！', '你做得很好！', '真厉害！'],
    incorrect: ['没关系，慢慢来', '再来一次，你可以的', '别着急，跟我读'],
    silence: ['试着跟我说一遍', '张开嘴，大胆说出来', '没关系的，试试看'],
    start: ['准备好了吗？跟我一起读。']
  },
  medium: {
    correct: ['不错！继续加油', '很好！', '有进步！', '很棒！'],
    incorrect: ['再试一次', '注意发音哦', '仔细听我说'],
    silence: ['试着读出来吧', '你可以的，试试', '大胆说'],
    start: ['准备开始了。']
  },
  hard: {
    correct: ['很好', '继续', '不错', '可以'],
    incorrect: ['不对', '再试', '注意'],
    silence: ['请回答', '该你了'],
    start: ['开始。']
  }
};
