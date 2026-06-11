// errorPatterns.js - 小学生常见英语错误模式库
// 每个规则包含：id, pattern(正则), description(中文描述), suggestion(修正建议), severity, difficulty

export const ERROR_PATTERNS = {

  // --- 发音类错误 (基于语音识别文本推测) ---
  pronunciation: [
    {
      id: 'th_sound_voiceless',
      pattern: /\b(free|tree|sing|ting|sank|fank)\b/gi,
      description: '/θ/ 发音不准确',
      suggestion: '"th" 发音时舌尖轻触上齿，轻轻吹气',
      severity: 'major',
      difficulty: 'all'
    },
    {
      id: 'th_sound_voiced',
      pattern: /\b(dis|dat|dey|dere|mudder|fader)\b/gi,
      description: '/ð/ 发音不准确',
      suggestion: '"th" 发音时舌尖轻触上齿，声带振动',
      severity: 'major',
      difficulty: 'all'
    },
    {
      id: 'r_l_confusion',
      pattern: /\b(light|lice|filed|gass|pray|fry|glue|bule|lemon)\b/gi,
      description: 'r/l 发音混淆',
      suggestion: '"r" 要卷舌头，"l" 舌尖抵住上颚',
      severity: 'major',
      difficulty: 'easy'
    },
    {
      id: 'v_w_confusion',
      pattern: /\b(wery|bery|wase|wocal|walue|wictory)\b/gi,
      description: 'v/w 发音混淆',
      suggestion: '"v" 上牙轻轻咬住下唇发音',
      severity: 'major',
      difficulty: 'all'
    },
    {
      id: 's_sh_confusion',
      pattern: /\b(sip|sow|sarp|fis|was)\b/gi,
      description: 's/sh 发音混淆',
      suggestion: '"sh" 嘴唇要圆起来，像说"嘘"',
      severity: 'minor',
      difficulty: 'medium'
    },
    {
      id: 'n_ng_confusion',
      pattern: /\b(sin|rin|kin|din|thin)\b/gi,
      description: 'n/ng 发音混淆',
      suggestion: '"ng" 用鼻子发音，舌头后部抬起',
      severity: 'minor',
      difficulty: 'medium'
    },
    {
      id: 'final_consonant_missing',
      pattern: /\b\w+(?<![ptkbdgmnlrsz])$/gmi,
      description: '词尾辅音遗漏',
      suggestion: '记住把每个单词的尾音发出来',
      severity: 'minor',
      difficulty: 'easy'
    },
    {
      id: 'long_short_vowel',
      pattern: /\b(ship|sheep|bit|beat|fill|feel|sit|seat)\b/gi,
      description: '长元音/短元音不分',
      suggestion: '长元音要延长，短元音短促有力',
      severity: 'minor',
      difficulty: 'hard'
    }
  ],

  // --- 语法类错误 ---
  grammar: [
    {
      id: 'third_person_s',
      pattern: /\b(he|she|it|my father|my mother|the boy|the girl)\s+(like|go|have|do|play|eat|want|run|walk|read)\b/gi,
      description: '第三人称单数缺少 -s/-es',
      suggestion: 'He/She/It 后面的动词要加 s 或 es，比如 likes, goes, has',
      severity: 'critical',
      difficulty: 'medium'
    },
    {
      id: 'plural_missing',
      pattern: /\b(two|three|four|five|six|seven|eight|nine|ten|many|some|a lot of|several)\s+(\w+)(?!s\b)(?!es\b)/gi,
      description: '名词复数缺少 -s/-es',
      suggestion: '表示多个东西时，名词后面要加 s 或 es',
      severity: 'critical',
      difficulty: 'easy'
    },
    {
      id: 'article_missing',
      pattern: /\b(is|am|are)\s+(?!a\b|an\b|the\b|my\b|his\b|her\b|this\b|that\b)\w+\b/gi,
      description: '单数名词前缺少冠词 a/an',
      suggestion: '单个东西前面通常要有 a 或 an',
      severity: 'minor',
      difficulty: 'hard'
    },
    {
      id: 'be_verb_wrong',
      pattern: /\b(I\s+is|he\s+am|she\s+are|they\s+is|we\s+is|you\s+is)\b/gi,
      description: 'be 动词搭配错误',
      suggestion: 'I 用 am，He/She/It 用 is，You/We/They 用 are',
      severity: 'critical',
      difficulty: 'easy'
    },
    {
      id: 'past_tense_missing',
      pattern: /\b(yesterday|last|ago|just now)\b.*\b(go|come|eat|play|do|see|have|get)(?!ed|ing|went|came|ate|did)\b/gi,
      description: '过去时态缺少过去式',
      suggestion: '描述过去的事情，动词要用过去式',
      severity: 'major',
      difficulty: 'hard'
    },
    {
      id: 'be_verb_ing_missing',
      pattern: /\b(he|she|it|they|we|you)\s+(?!am|is|are|was|were)(swimming|running|eating|playing|reading|writing|singing)\b/gi,
      description: '现在进行时缺少 be 动词',
      suggestion: '现在进行时 = 主语 + am/is/are + 动词ing',
      severity: 'critical',
      difficulty: 'medium'
    },
    {
      id: 'do_does_wrong',
      pattern: /\b(he|she|it)\s+don't\b/gi,
      description: 'does/doesn\'t 用错',
      suggestion: 'He/She/It 用 doesn\'t，I/You/We/They 用 don\'t',
      severity: 'major',
      difficulty: 'medium'
    },
    {
      id: 'preposition_wrong',
      pattern: /\b(in the Monday|on the morning|at home\s+at|in\s+at)\b/gi,
      description: '介词使用不当',
      suggestion: 'at+时间点，on+具体日期/星期，in+月份/年份/上午下午',
      severity: 'minor',
      difficulty: 'hard'
    }
  ],

  // --- 用词类错误 ---
  vocabulary: [
    {
      id: 'chinese_english_mix',
      pattern: /\b(hao|de|le|ma|ba|ne|ya|a|la|wa|en|o)\b/gi,
      description: '中英混用',
      suggestion: '说英语时尽量不要说中文哦',
      severity: 'critical',
      difficulty: 'all'
    },
    {
      id: 'very_much_order',
      pattern: /\b(very like|very love|very want|very need)\b/gi,
      description: '中式英语语序',
      suggestion: '英语说 "like ... very much"，不要说 "very like"',
      severity: 'major',
      difficulty: 'medium'
    },
    {
      id: 'how_to_say_zhongshi',
      pattern: /\b(how to say|how to spell|how to write)\b.*\?/gi,
      description: '中式表达 "How to..."',
      suggestion: '应该用 "How do you say...?" 来问问题',
      severity: 'minor',
      difficulty: 'hard'
    },
    {
      id: 'i_very_zhongshi',
      pattern: /\b(I very|you very|he very|she very)\b/gi,
      description: '中文式 "我很…" 直译',
      suggestion: '英语说 "I am very..." 要加 be 动词',
      severity: 'critical',
      difficulty: 'easy'
    },
    {
      id: 'have_not_zhongshi',
      pattern: /\b(I have not|you have not|they have not)\s+\w+\b/gi,
      description: '"没有" 的中式表达',
      suggestion: '应该说 "I don\'t have..." 或 "I have no..."',
      severity: 'major',
      difficulty: 'medium'
    },
    {
      id: 'and_with_zhongshi',
      pattern: /\b(I with|he with|she with|we with)\s+\w+\s+\w+\b/gi,
      description: '中文 "和…一起" 直译',
      suggestion: '英语中 "我和…" 直接说 "... and I"，不用 with',
      severity: 'major',
      difficulty: 'medium'
    }
  ],

  // --- 流畅度类 ---
  fluency: [
    {
      id: 'long_pause',
      pattern: /^$/,
      description: '说话停顿过长',
      suggestion: '试着把句子连起来读，不要一个词一个词断开',
      severity: 'minor',
      difficulty: 'all'
    },
    {
      id: 'hesitation_filler',
      pattern: /\b(um|uh|er|mm|eh)\b/gi,
      description: '过多犹豫词 (um/uh)',
      suggestion: '想不起来时深吸一口气，重新开始说',
      severity: 'minor',
      difficulty: 'all'
    }
  ]
};
