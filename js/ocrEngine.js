// ocrEngine.js - OCR 识别流水线 (Tesseract.js)
import { CONFIG } from './config.js';

export class OCREngine {
  constructor() {
    this.worker = null;
    this.onProgress = null;
  }

  // 主入口：图片 → 文本
  async processImage(imageFile, onProgress) {
    this.onProgress = onProgress || (() => {});

    try {
      // 步骤 1: 预处理
      this.reportProgress(10, '正在准备图片…');
      const canvas = await this.preprocessImage(imageFile);

      // 步骤 2: OCR 识别
      this.reportProgress(30, '正在识别文字…');
      const result = await this.recognize(canvas);

      // 步骤 3: 文本清洗
      this.reportProgress(80, '正在整理文本…');
      const cleaned = this.cleanText(result.text, result.words);

      this.reportProgress(100, '识别完成！');
      return {
        rawText: result.text,
        cleanedText: cleaned.cleanedText,
        sentences: cleaned.sentences,
        confidence: result.confidence,
        words: result.words || [],
        processingTime: result.processingTime || 0
      };
    } catch (error) {
      throw new Error(`OCR 识别失败: ${error.message}`);
    }
  }

  // 图片预处理
  async preprocessImage(imageFile) {
    const img = await this.loadImage(imageFile);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const ocrCfg = CONFIG.ocr;
    const targetWidth = ocrCfg.targetWidth;
    const scale = Math.min(targetWidth / img.width, 1.5); // 最多放大1.5倍
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);

    // 绘制图片
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // 获取图像数据
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // 灰度化 + 二值化
    this.binarize(imageData, ocrCfg.binarizeThreshold);

    // 对比度增强
    this.enhanceContrast(imageData, ocrCfg.contrastFactor);

    // 写回 Canvas
    ctx.putImageData(imageData, 0, 0);

    return canvas;
  }

  // 灰度化 + 二值化
  binarize(imageData, threshold = 128) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const value = gray > threshold ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = value;
    }
  }

  // 对比度增强
  enhanceContrast(imageData, factor = 1.5) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      for (let j = 0; j < 3; j++) {
        const val = (data[i + j] - 128) * factor + 128;
        data[i + j] = Math.max(0, Math.min(255, val));
      }
    }
  }

  // 加载图片
  loadImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }

  // Tesseract OCR 识别
  async recognize(canvas) {
    if (typeof Tesseract === 'undefined') {
      throw new Error('Tesseract.js 未加载，请检查网络连接');
    }

    const ocrCfg = CONFIG.ocr;
    const startTime = Date.now();

    try {
      const worker = await Tesseract.createWorker(ocrCfg.language, 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const pct = 30 + Math.round((m.progress || 0) * 50);
            this.reportProgress(pct, '正在识别文字…');
          }
        }
      });

      await worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        tessedit_char_whitelist:
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?\'"()\\-:; ',
      });

      const result = await worker.recognize(canvas);
      await worker.terminate();

      return {
        text: result.data.text,
        confidence: result.data.confidence,
        words: (result.data.words || []).map(w => ({
          text: w.text,
          confidence: w.confidence,
          bbox: w.bbox
        })),
        processingTime: Date.now() - startTime
      };
    } catch (e) {
      throw new Error(`Tesseract 识别出错: ${e.message}`);
    }
  }

  // 文本清洗
  cleanText(rawText, words = []) {
    let text = rawText || '';

    // 低置信度词修正
    const lowConfWords = words.filter(w => w.confidence < 50);
    const fixes = [
      [/\b([a-z]+)0([a-z]*)\b/gi, '$1o$2'],      // 数字0 → 字母o
      [/([A-Z])\s+([a-z])/g, '$1$2'],              // 大写字母错误分隔 (H ello → Hello)
    ];

    for (const [pattern, replacement] of fixes) {
      text = text.replace(pattern, replacement);
    }

    // 合并断行
    // 连字符断行: "hap-\npy" → "happy"
    text = text.replace(/([a-z])-\s*\n\s*([a-z])/gi, '$1$2');
    // 行中普通断行
    text = text.replace(/([a-z,;])\s*\n\s*([a-z])/gi, '$1 $2');
    // 保留段落间距 (双换行)
    text = text.replace(/\n{2,}/g, '\n\n');
    // 清理多余空格
    text = text.replace(/\s{2,}/g, ' ');

    // 提取句子 (按 . ! ? 分割)
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 1);

    return {
      cleanedText: text.trim(),
      sentences
    };
  }

  // 进度回调
  reportProgress(pct, hint) {
    if (this.onProgress) {
      this.onProgress({ pct, hint });
    }
  }
}
