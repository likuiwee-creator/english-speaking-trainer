// speechEngine.js - 语音识别 + 语音合成封装
import { CONFIG } from './config.js';

export class SpeechEngine {
  constructor() {
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    this.isListening = false;
    this.isSpeaking = false;
    this.silenceTimer = null;
    this.onInterimResult = null;
    this.onFinalResult = null;
    this.onError = null;

    // 兼容性检测
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.supportsRecognition = !!SR;
    this.supportsSynthesis = !!window.speechSynthesis;

    // 预加载语音列表
    if (this.supportsSynthesis) {
      this.synthesis.getVoices();
      this.synthesis.onvoiceschanged = () => this.synthesis.getVoices();
    }
  }

  // 获取降级模式
  getFallbackMode() {
    if (!this.supportsRecognition && !this.supportsSynthesis) return 'TEXT_ONLY';
    if (!this.supportsRecognition) return 'TEXT_INPUT';
    if (!this.supportsSynthesis) return 'VOICE_ONLY';
    return 'FULL';
  }

  // ========== 语音识别 ==========

  startListening(options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.supportsRecognition) {
        reject(new Error('NOT_SUPPORTED'));
        return;
      }

      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SR();
      this.recognition.lang = options.lang || CONFIG.speech.lang;
      this.recognition.continuous = options.continuous ?? CONFIG.speech.continuous;
      this.recognition.interimResults = options.interimResults ?? CONFIG.speech.interimResults;
      this.recognition.maxAlternatives = options.maxAlternatives ?? CONFIG.speech.maxAlternatives;

      let finalTranscript = '';
      let bestConfidence = 0;
      let hasSpeech = false; // 检测是否有人说话

      this.recognition.onstart = () => {
        this.isListening = true;
        // 启动静默超时
        this.silenceTimer = setTimeout(() => {
          if (!hasSpeech) {
            this.stopListening();
            resolve({ transcript: '', confidence: 0, silent: true });
          }
        }, options.silenceTimeout || CONFIG.speech.silenceTimeout);
      };

      this.recognition.onaudiostart = () => {
        hasSpeech = true;
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
      };

      this.recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript = result[0].transcript;
            bestConfidence = result[0].confidence;
          } else {
            interim += result[0].transcript;
          }
        }
        // 实时回调
        if (this.onInterimResult) {
          this.onInterimResult(interim || finalTranscript);
        }
      };

      this.recognition.onspeechend = () => {
        this.isListening = false;
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
        this.recognition.stop();
        if (this.onFinalResult) {
          this.onFinalResult(finalTranscript);
        }
        resolve({
          transcript: finalTranscript.trim(),
          confidence: bestConfidence,
          silent: !finalTranscript.trim()
        });
      };

      this.recognition.onerror = (event) => {
        this.isListening = false;
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
        const err = new Error(event.error);
        if (this.onError) this.onError(err);
        reject(err);
      };

      this.recognition.onnomatch = () => {
        // 说了但没识别到，也算有声音
        hasSpeech = true;
      };

      this.recognition.onend = () => {
        this.isListening = false;
      };

      try {
        this.recognition.start();
      } catch (e) {
        this.isListening = false;
        reject(e);
      }
    });
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) { /* ignore */ }
      this.isListening = false;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  // ========== 语音合成 (TTS) ==========

  speak(text, options = {}) {
    return new Promise((resolve) => {
      if (!this.supportsSynthesis || !text) {
        resolve();
        return;
      }

      // 取消之前的语音
      this.synthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = options.lang || CONFIG.tts.lang;
      utterance.rate = options.rate ?? CONFIG.tts.defaultRate;
      utterance.pitch = options.pitch ?? CONFIG.tts.defaultPitch;
      utterance.volume = options.volume ?? CONFIG.tts.volume;

      // 选择最佳英文语音
      const voices = this.synthesis.getVoices();
      const enVoice = voices.find(v =>
        v.lang.startsWith('en') &&
        (v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel'))
      ) || voices.find(v => v.lang.startsWith('en-US'))
        || voices.find(v => v.lang.startsWith('en'));

      if (enVoice) utterance.voice = enVoice;

      this.isSpeaking = true;

      utterance.onend = () => {
        this.isSpeaking = false;
        resolve();
      };

      utterance.onerror = () => {
        this.isSpeaking = false;
        resolve();
      };

      // 某些浏览器需要用户交互后才能 speak，用 timeout 兜底
      const timeout = setTimeout(() => {
        if (this.isSpeaking) {
          this.isSpeaking = false;
          resolve();
        }
      }, 30000);

      utterance.onend = () => {
        clearTimeout(timeout);
        this.isSpeaking = false;
        resolve();
      };

      this.synthesis.speak(utterance);
    });
  }

  // 停止所有语音
  cancelSpeech() {
    if (this.supportsSynthesis) {
      this.synthesis.cancel();
      this.isSpeaking = false;
    }
  }

  // 获取可用语音列表
  getVoices() {
    return this.supportsSynthesis ? this.synthesis.getVoices() : [];
  }
}
