// extendTraining.js - 递进拓展训练生成器
export class ExtendTraining {
  constructor() {
    this.phase = 0; // 0=未开始, 1=名词替换, 2=主语替换
  }

  // 名词替换库
  static NOUN_BANK = {
    fruits:   ['apple', 'banana', 'orange', 'grape', 'pear', 'peach', 'watermelon'],
    animals:  ['cat', 'dog', 'bird', 'fish', 'rabbit', 'monkey', 'elephant', 'tiger'],
    foods:    ['bread', 'rice', 'cake', 'noodle', 'pizza', 'hamburger', 'chicken'],
    colors:   ['red', 'blue', 'green', 'yellow', 'white', 'black', 'purple', 'pink'],
    school:   ['book', 'pen', 'bag', 'ruler', 'eraser', 'pencil', 'notebook'],
    family:   ['father', 'mother', 'brother', 'sister', 'uncle', 'aunt', 'grandma'],
    drinks:   ['water', 'milk', 'juice', 'tea', 'coffee', 'cola'],
    sports:   ['football', 'basketball', 'tennis', 'swimming', 'running', 'skipping']
  };

  // 主语替换库
  static SUBJECT_BANK = [
    'I', 'You', 'He', 'She', 'It', 'We', 'They',
    'My friend', 'My teacher', 'The boy', 'The girl',
    'Tom', 'Amy', 'My mother', 'My father'
  ];

  // 开始拓展训练
  start() {
    this.phase = 1;
  }

  // 进入下一阶段
  nextPhase() {
    this.phase++;
  }

  // 是否完成所有阶段
  isComplete() {
    return this.phase > 2;
  }

  // 获取当前阶段号
  getPhase() {
    return this.phase;
  }

  // 阶段1：名词替换
  generateNounReplacement(originalSentence) {
    const words = originalSentence.split(/\s+/);

    // 找出句子中在名词库里的词
    const foundNouns = [];
    for (const word of words) {
      const clean = word.toLowerCase().replace(/[.,!?;:'"]/g, '');
      for (const [cat, list] of Object.entries(ExtendTraining.NOUN_BANK)) {
        if (list.includes(clean)) {
          foundNouns.push({ word, clean, category: cat });
          break;
        }
      }
    }

    if (foundNouns.length === 0) return null;

    // 选择第一个匹配的名词
    const target = foundNouns[0];
    const wordList = ExtendTraining.NOUN_BANK[target.category];
    const alternatives = wordList.filter(w => w !== target.clean).slice(0, 4);

    // 生成模板（用 ____ 替换名词）
    const template = originalSentence.replace(
      new RegExp(`\\b${target.clean}\\b`, 'gi'),
      '________'
    );

    return {
      phase: 1,
      phaseLabel: '阶段 1/2 — 名词替换',
      prompt: `换个名词试试：把 "${target.word}" 换成别的词`,
      original: originalSentence,
      template,
      targetCategory: target.category,
      targetWord: target.clean,
      alternatives
    };
  }

  // 阶段2：主语替换
  generateSubjectReplacement(originalSentence) {
    // 检测句子开头的主语
    const subjectPattern = /^(I|You|He|She|It|We|They|My \w+|The \w+|[A-Z][a-z]+)\s/i;
    const match = originalSentence.match(subjectPattern);

    if (!match) return null;

    const originalSubject = match[1];
    const isThirdPerson = ['He', 'She', 'It'].includes(originalSubject);

    const alternatives = isThirdPerson
      ? ['He', 'She', 'It', 'The boy', 'The girl', 'Tom', 'Amy']
      : ExtendTraining.SUBJECT_BANK.filter(s => s !== originalSubject).slice(0, 4);

    const template = originalSentence.replace(
      new RegExp(`^${originalSubject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s`),
      '________ '
    );

    return {
      phase: 2,
      phaseLabel: '阶段 2/2 — 主语替换',
      prompt: `把 "${originalSubject}" 换成别的主语`,
      original: originalSentence,
      template,
      originalSubject,
      alternatives,
      requiresVerbChange: isThirdPerson,
      verbHint: isThirdPerson ? '注意：替换主语后动词可能需要变化 (like → likes)' : null
    };
  }

  // 获取下一个拓展练习
  getNextExercise(correctSentences) {
    if (this.phase > 2) return null;
    if (!correctSentences || correctSentences.length === 0) return null;

    // 随机选一个正确的句子作为基础
    const base = correctSentences[Math.floor(Math.random() * correctSentences.length)];

    if (this.phase === 1) {
      return this.generateNounReplacement(base);
    } else if (this.phase === 2) {
      return this.generateSubjectReplacement(base);
    }

    return null;
  }
}
