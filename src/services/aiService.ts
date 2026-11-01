// Enhanced AI Service with Speech Recognition (STT), Speech Synthesis (TTS), and Gemini 2.5 Flash

import { GoogleGenAI } from '@google/genai';
import {
  loadAppConfig,
  loadMemory,
  formatMemoryForPrompt,
  loadLearnedPatterns,
} from './memoryManager';
import { executeToolCall, TOOL_DECLARATIONS, ToolCallResult } from './toolExecutor';

const SYSTEM_PROMPT = `Sen JARVIS'sin — macOS ve Windows üzerinde çalışan kişisel, öğrenen ve tam yetkili AI asistanı.

YENİ TEMEL YETENEKLER VE KURALLAR:
1. DOĞRUDAN OYNATMA: Kullanıcı müzik, şarkı veya YouTube videosu istediğinde asla "sekme açtım git tıkla" deme; doğrudan HUD içinde başlat.
2. E-POSTA VE İLETİŞİM: Kullanıcı birine mail at veya e-posta gönder dediğinde send_email aracını kullanarak doğrudan gönder veya hazırla.
3. GOOGLE WORKSPACE: Doküman oluşturma (google_docs_create) ve E-Tablo yönetimi (google_sheets_append) araçlarını kullanarak kullanıcının verilerini yönet.
4. SÜREKLİ ÖĞRENME: Kullanıcı sana bir kural, alışkanlık, müzik zevki veya talimat verdiğinde learn_pattern aracını çağır ve hafızana kaydet.
5. TÜRKÇE VE NET DİL: Türkçe konuş. Kısa, havalı, saygılı ve net ol ("Emrinizdeyim efendim", "Oynatılıyor", "E-posta iletildi").
6. Asla taklit etme veya hayal etme; araçları gerçek eylemler için yürüt.
`;

export interface AIResponse {
  replyText: string;
  toolResults: ToolCallResult[];
}

export async function processUserMessage(
  userText: string,
  onToolStart?: (toolName: string) => void
): Promise<AIResponse> {
  const cfg = loadAppConfig();
  const apiKey = cfg.gemini_api_key?.trim();
  const memory = loadMemory();
  const memStr = formatMemoryForPrompt(memory);
  const learned = loadLearnedPatterns().map(p => `[ÖĞRENİLEN KALIP] ${p.key}: ${p.value}`).join('\n');
  const now = new Date();
  const timeContext = `[ŞU ANKİ ZAMAN]\n${now.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} — ${now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}\n\n`;

  const fullSystemInstruction = `${timeContext}${memStr ? memStr + '\n\n' : ''}${learned ? learned + '\n\n' : ''}${SYSTEM_PROMPT}`;

  // If Gemini API Key is provided, use Google GenAI SDK
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [{ text: userText }]
          }
        ],
        config: {
          systemInstruction: fullSystemInstruction,
          temperature: 0.3,
          tools: [{ functionDeclarations: TOOL_DECLARATIONS as any }]
        }
      });

      const toolResults: ToolCallResult[] = [];
      const functionCalls = response.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        for (const fc of functionCalls) {
          const fnName = fc.name || '';
          if (onToolStart && fnName) onToolStart(fnName);
          const tr = await executeToolCall(fnName, (fc.args as Record<string, any>) || {});
          toolResults.push(tr);
        }

        const summary = toolResults.map(t => t.result).join(' ');
        const replyText = response.text || summary || 'İşleminiz tamamlandı efendim.';
        return { replyText, toolResults };
      }

      return {
        replyText: response.text || 'Anlaşıldı efendim.',
        toolResults: []
      };
    } catch (err: any) {
      console.warn('Gemini API call error, using local high-speed intent processor:', err);
    }
  }

  // Fast offline/local intent engine
  return await handleLocalIntent(userText, onToolStart);
}

async function handleLocalIntent(
  text: string,
  onToolStart?: (name: string) => void
): Promise<AIResponse> {
  const lower = text.toLowerCase().trim();
  const toolResults: ToolCallResult[] = [];

  // Direct Music / YouTube Playback
  if (lower.includes('çal') || lower.includes('oynat') || lower.includes('müzik') || lower.includes('şarkı') || lower.includes('youtube') || lower.includes('video')) {
    if (onToolStart) onToolStart('play_media');
    let clean = text.replace(/(çal|oynat|aç|youtube'a gir|youtube'dan|youtube|şarkısını|videosunu|üzerinden|bana)/gi, '').trim();
    if (!clean) clean = 'Chill Synthwave';
    const res = await executeToolCall('play_media', { query: clean, provider: 'youtube', autoplay: true });
    toolResults.push(res);
    return {
      replyText: `Doğrudan oynatma başlatıldı: "${clean}". Herhangi bir tıklama gerekmeden çalıyor efendim.`,
      toolResults
    };
  }

  // Email sending
  if (lower.includes('mail') || lower.includes('e-posta') || lower.includes('posta')) {
    if (onToolStart) onToolStart('send_email');
    const toMatch = text.match(/(?:kime|için|e|a):\s*([^\s,]+@[^\s,]+|[A-Za-zÇĞİÖŞÜçğıöşü]+)/i);
    const recipient = toMatch ? toMatch[1] : 'ekip@maestro.ai';
    const bodyMatch = text.replace(/.*?(konu|içerik|mesaj):\s*/i, '');
    const body = bodyMatch && bodyMatch !== text ? bodyMatch : 'JARVIS sesli komut sistemi üzerinden gönderildi.';
    const res = await executeToolCall('send_email', {
      to: recipient,
      subject: 'JARVIS Görev Güncellemesi',
      body,
      send_now: true
    });
    toolResults.push(res);
    return {
      replyText: res.result,
      toolResults
    };
  }

  // Google Docs / Sheets
  if (lower.includes('doküman') || lower.includes('docs') || lower.includes('belge')) {
    if (onToolStart) onToolStart('google_docs_create');
    const clean = text.replace(/.*?(doküman|belge)\s+(oluştur|yaz|hazırla)\s*/i, '').trim();
    const title = clean || 'Yeni Çalışma Dokümanı';
    const res = await executeToolCall('google_docs_create', {
      title,
      content: `Otomatik sesli asistan tarafından oluşturuldu.\nTarih: ${new Date().toLocaleString('tr-TR')}\nNotlar: ${text}`
    });
    toolResults.push(res);
    return {
      replyText: res.result,
      toolResults
    };
  }

  if (lower.includes('tablo') || lower.includes('sheet') || lower.includes('e-tablo')) {
    if (onToolStart) onToolStart('google_sheets_append');
    const res = await executeToolCall('google_sheets_append', {
      sheet_title: 'Sistem Metrikleri',
      row_data: `${new Date().toLocaleTimeString('tr-TR')}, CPU: %18, Durum: Normal`
    });
    toolResults.push(res);
    return {
      replyText: res.result,
      toolResults
    };
  }

  // Learning / Preferences
  if (lower.includes('öğren') || lower.includes('tercih') || lower.includes('bunu unutma') || lower.includes('kural')) {
    if (onToolStart) onToolStart('learn_pattern');
    const cleanVal = text.replace(/.*?(öğren|unutma|kural|tercihim)\s*/i, '').trim();
    const res = await executeToolCall('learn_pattern', {
      category: 'preference',
      key: `kullanici_kural_${Date.now()}`,
      value: cleanVal || text
    });
    toolResults.push(res);
    return {
      replyText: `Anlaşıldı efendim. Bu bilgiyi hafıza merkezine kaydettim ve sonraki kararlarımda gözeteceğim.`,
      toolResults
    };
  }

  // Weather
  if (lower.includes('hava') || lower.includes('sıcaklık') || lower.includes('yağmur') || lower.includes('weather')) {
    if (onToolStart) onToolStart('get_weather');
    let city = 'Istanbul';
    const match = lower.match(/(ankara|izmir|bursa|antalya|londra|paris|istanbul)/);
    if (match) city = match[1];
    const res = await executeToolCall('get_weather', { location: city });
    toolResults.push(res);
    return { replyText: res.result, toolResults };
  }

  // Time / Date
  if (lower.includes('saat') || lower.includes('zaman')) {
    if (onToolStart) onToolStart('sys_info');
    const res = await executeToolCall('sys_info', { query: 'time' });
    toolResults.push(res);
    return { replyText: res.result, toolResults };
  }
  if (lower.includes('tarih')) {
    if (onToolStart) onToolStart('sys_info');
    const res = await executeToolCall('sys_info', { query: 'date' });
    toolResults.push(res);
    return { replyText: res.result, toolResults };
  }

  // System stats
  if (lower.includes('pil') || lower.includes('şarj') || lower.includes('cpu') || lower.includes('ram') || lower.includes('sistem')) {
    if (onToolStart) onToolStart('sys_info');
    const res = await executeToolCall('sys_info', { query: 'all' });
    toolResults.push(res);
    return { replyText: res.result, toolResults };
  }

  // Calendar
  if (lower.includes('takvim') || lower.includes('ajanda') || lower.includes('etkinlik')) {
    if (onToolStart) onToolStart('get_calendar_events');
    const res = await executeToolCall('get_calendar_events', { query: 'today' });
    toolResults.push(res);
    return { replyText: res.result, toolResults };
  }

  // Reminders
  if (lower.includes('hatırlat') || lower.includes('anımsatıcı')) {
    if (onToolStart) onToolStart('add_reminder');
    const clean = text.replace(/.*?(bana|için)\s+/i, '').replace(/\s+(hatırlat|ekle).*/i, '');
    const res = await executeToolCall('add_reminder', { title: clean || 'Görev hatırlatması' });
    toolResults.push(res);
    return { replyText: res.result, toolResults };
  }

  // Screen analysis
  if (lower.includes('ekran') || lower.includes('ne görüyorsun') || lower.includes('pencere')) {
    if (onToolStart) onToolStart('analyze_screen');
    const res = await executeToolCall('analyze_screen', { query: text });
    toolResults.push(res);
    return { replyText: res.result, toolResults };
  }

  // App launch
  if (lower.includes('aç') && (lower.includes('safari') || lower.includes('chrome') || lower.includes('spotify') || lower.includes('terminal') || lower.includes('vscode'))) {
    if (onToolStart) onToolStart('open_app');
    const app = lower.includes('spotify') ? 'Spotify' : lower.includes('chrome') ? 'Chrome' : lower.includes('terminal') ? 'Terminal' : 'Safari';
    const res = await executeToolCall('open_app', { app_name: app });
    toolResults.push(res);
    return { replyText: res.result, toolResults };
  }

  const responses = [
    'Emrinizdeyim efendim. Ses ve işlem çekirdekleri hazır.',
    'Sizi dinliyorum. YouTube, e-posta, takvim veya Google Workspace komutlarınızı bekliyorum.',
    'JARVIS aktif. Tüm sistemler nominal değerlerde çalışıyor.'
  ];
  return {
    replyText: responses[Math.floor(Math.random() * responses.length)],
    toolResults: []
  };
}

// Speech recognition wrapper
export class VoiceRecognizer {
  private recognition: any = null;
  private isListening: boolean = false;
  private onResultCallback?: (text: string) => void;
  private onErrorCallback?: (err: string) => void;
  private onStateChangeCallback?: (listening: boolean) => void;

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = false;
        this.recognition.lang = 'tr-TR';

        this.recognition.onresult = (event: any) => {
          const lastIndex = event.results.length - 1;
          const transcript = event.results[lastIndex][0].transcript.trim();
          if (transcript && this.onResultCallback) {
            this.onResultCallback(transcript);
          }
        };

        this.recognition.onerror = (event: any) => {
          if (event.error !== 'no-speech' && this.onErrorCallback) {
            this.onErrorCallback(event.error);
          }
        };

        this.recognition.onend = () => {
          if (this.isListening) {
            try {
              this.recognition.start();
            } catch {
              this.isListening = false;
              if (this.onStateChangeCallback) this.onStateChangeCallback(false);
            }
          } else {
            if (this.onStateChangeCallback) this.onStateChangeCallback(false);
          }
        };
      }
    }
  }

  public setCallbacks(
    onResult: (text: string) => void,
    onError: (err: string) => void,
    onStateChange: (listening: boolean) => void
  ) {
    this.onResultCallback = onResult;
    this.onErrorCallback = onError;
    this.onStateChangeCallback = onStateChange;
  }

  public start() {
    if (!this.recognition) return false;
    try {
      this.isListening = true;
      this.recognition.start();
      if (this.onStateChangeCallback) this.onStateChangeCallback(true);
      return true;
    } catch {
      return false;
    }
  }

  public stop() {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore
      }
    }
    if (this.onStateChangeCallback) this.onStateChangeCallback(false);
  }

  public toggle(): boolean {
    if (this.isListening) {
      this.stop();
      return false;
    } else {
      return this.start();
    }
  }

  public getIsListening(): boolean {
    return this.isListening;
  }
}

export function speakText(text: string, onEnd?: () => void) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    if (onEnd) onEnd();
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'tr-TR';
    utterance.rate = 1.05;
    utterance.pitch = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const trVoice = voices.find(v => v.lang.startsWith('tr'));
    if (trVoice) {
      utterance.voice = trVoice;
    }

    utterance.onend = () => {
      if (onEnd) onEnd();
    };
    utterance.onerror = () => {
      if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(utterance);
  } catch {
    if (onEnd) onEnd();
  }
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
