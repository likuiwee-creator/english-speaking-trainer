// speechEngine.js - 语音引擎：SpeechRecognition (降级) + MediaRecorder 录音 + TTS
import { CONFIG } from './config.js';

export class SpeechEngine {
  constructor() {
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    this.isListening = false;
    this.isSpeaking = false;
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.audioStream = null;
    this.silenceTimer = null;
    this.onInterimResult = null;
    this.onFinalResult = null;
    this.onError = null;

    // 兼容性检测
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.supportsSpeechAPI = !!SR;
    this.supportsSynthesis = !!window.speechSynthesis;
    this.supportsMediaRecorder = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

    if (this.supportsSynthesis) {
      this.synthesis.getVoices();
      this.synthesis.onvoiceschanged = () => this.synthesis.getVoices();
    }
  }

  // 降级模式
  getFallbackMode() {
    if (this.supportsSpeechAPI) return 'FULL';
    if (this.supportsMediaRecorder) return 'RECORD_ONLY';
    return 'TEXT_ONLY';
  }

  // ========== 方式1: Web Speech API ==========
  startSpeechRecognition(options = {}) {
    return new Promise((resolve, reject) => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { reject(new Error('NOT_SUPPORTED')); return; }

      this.recognition = new SR();
      this.recognition.lang = options.lang || CONFIG.speech.lang;
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 3;

      let finalTranscript = '';
      let hasSpeech = false;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.silenceTimer = setTimeout(() => {
          if (!hasSpeech) {
            this.stopAll();
            resolve({ transcript: '', silent: true, method: 'speech_api' });
          }
        }, options.silenceTimeout || 5000);
      };

      this.recognition.onaudiostart = () => {
        hasSpeech = true;
        if (this.silenceTimer) { clearTimeout(this.silenceTimer); this.silenceTimer = null; }
      };

      this.recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          if (r.isFinal) { finalTranscript = r[0].transcript; }
          else if (this.onInterimResult) { this.onInterimResult(r[0].transcript); }
        }
      };

      this.recognition.onspeechend = () => {
        this.isListening = false;
        if (this.silenceTimer) { clearTimeout(this.silenceTimer); }
        this.recognition.stop();
        if (this.onFinalResult) this.onFinalResult(finalTranscript);
        resolve({ transcript: finalTranscript.trim(), silent: !finalTranscript.trim(), method: 'speech_api' });
      };

      this.recognition.onerror = (event) => {
        this.isListening = false;
        if (this.silenceTimer) { clearTimeout(this.silenceTimer); }
        reject(new Error(event.error));
      };

      this.recognition.onend = () => { this.isListening = false; };

      try { this.recognition.start(); }
      catch (e) { this.isListening = false; reject(e); }
    });
  }

  // ========== 方式2: MediaRecorder 录音 ==========
  async startRecording() {
    if (!this.supportsMediaRecorder) throw new Error('NOT_SUPPORTED');

    this.audioChunks = [];
    this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    this.mediaRecorder = new MediaRecorder(this.audioStream, { mimeType });
    this.isRecording = true;

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.audioChunks.push(e.data);
    };

    return new Promise((resolve, reject) => {
      this.mediaRecorder.onstop = async () => {
        this.isRecording = false;
        const blob = new Blob(this.audioChunks, { type: mimeType });
        this._releaseStream();
        resolve({ blob, method: 'media_recorder' });
      };

      this.mediaRecorder.onerror = (e) => {
        this.isRecording = false;
        this._releaseStream();
        reject(new Error('recorder_error'));
      };

      this.mediaRecorder.start();
    });
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      try { this.mediaRecorder.stop(); } catch (e) { /* ignore */ }
    }
  }

  _releaseStream() {
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(t => t.stop());
      this.audioStream = null;
    }
  }

  // 将录音 blob 转为 base64
  blobToBase64(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });
  }

  // ========== TTS 语音合成 ==========
  speak(text, options = {}) {
    return new Promise((resolve) => {
      if (!this.supportsSynthesis || !text) { resolve(); return; }
      this.synthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = options.lang || CONFIG.tts.lang;
      utterance.rate = options.rate ?? CONFIG.tts.defaultRate;
      utterance.pitch = options.pitch ?? CONFIG.tts.defaultPitch;
      utterance.volume = options.volume ?? CONFIG.tts.volume;

      const voices = this.synthesis.getVoices();
      const enVoice = voices.find(v =>
        v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel'))
      ) || voices.find(v => v.lang.startsWith('en-US')) || voices.find(v => v.lang.startsWith('en'));
      if (enVoice) utterance.voice = enVoice;

      this.isSpeaking = true;
      let done = false;
      const finish = () => { if (!done) { done = true; this.isSpeaking = false; resolve(); } };

      utterance.onend = finish;
      utterance.onerror = finish;
      setTimeout(finish, 30000);
      this.synthesis.speak(utterance);
    });
  }

  cancelSpeech() {
    if (this.supportsSynthesis) { this.synthesis.cancel(); this.isSpeaking = false; }
  }

  stopAll() {
    if (this.recognition && this.isListening) {
      try { this.recognition.stop(); } catch (e) {}
      this.isListening = false;
    }
    this.stopRecording();
    this.cancelSpeech();
    if (this.silenceTimer) { clearTimeout(this.silenceTimer); this.silenceTimer = null; }
  }
}
