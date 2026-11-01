// Memory Manager - LocalStorage persistence with fuzzy match, continuous learning & workspace docs

import { EmailMessage, WorkspaceDoc, LearnedPattern, AppConfig } from '../types';

const MEMORY_STORAGE_KEY = 'jarvis_mac_memory';
const CONFIG_STORAGE_KEY = 'jarvis_app_config';
const CALENDAR_STORAGE_KEY = 'jarvis_calendar_events';
const REMINDERS_STORAGE_KEY = 'jarvis_reminders';
const EMAILS_STORAGE_KEY = 'jarvis_emails';
const WORKSPACE_STORAGE_KEY = 'jarvis_workspace_docs';
const LEARNED_STORAGE_KEY = 'jarvis_learned_patterns';

export interface MemoryStore {
  identity: Record<string, { value: string }>;
  preferences: Record<string, { value: string }>;
  projects: Record<string, { value: string }>;
  notes: Record<string, { value: string }>;
  whatsapp_contacts: Record<string, {
    value: string;
    display_name: string;
    aliases?: string[];
  }>;
  learned_skills: Record<string, {
    description: string;
    trigger: string;
    action: string;
  }>;
  [category: string]: Record<string, any>;
}

const DEFAULT_MEMORY: MemoryStore = {
  identity: {
    owner: { value: 'Alp Ünlü' },
    role: { value: 'Creator & Orchestrator' }
  },
  preferences: {
    language: { value: 'Turkish' },
    assistant_name: { value: 'JARVIS' },
    default_weather_city: { value: 'Istanbul' },
    music_service: { value: 'YouTube / Spotify' },
    automation_mode: { value: 'Direct Autoplay & No manual click' }
  },
  projects: {
    maestroai: { value: 'Cross-platform real-time desktop AI orchestrator (macOS & Windows)' },
    google_workspace_integration: { value: 'Automated Gmail, Google Docs and Sheets voice orchestration' }
  },
  notes: {
    user_vision: { value: 'Sistemi kişiselleştirilmiş, gecikmesiz, doğrudan müzik/video oynatan ve mail atan sesli asistana dönüştür' }
  },
  whatsapp_contacts: {
    annem: {
      value: '+905551112233',
      display_name: 'Annem',
      aliases: ['anne', 'annem', 'mom']
    },
    ahmet: {
      value: '+905554445566',
      display_name: 'Ahmet',
      aliases: ['ahmet', 'iş ortağım']
    }
  },
  learned_skills: {
    direct_video_playback: {
      description: 'YouTube veya Spotify şarkısını sekme açıp bırakmak yerine doğrudan HUD içinde otomatik başlatır.',
      trigger: 'çal, oynat, youtube aç',
      action: 'play_media_direct'
    },
    mail_orchestration: {
      description: 'Gmail üzerinden tek sesli komutla doğrudan e-posta gönderir veya taslak oluşturur.',
      trigger: 'mail at, e-posta gönder',
      action: 'send_email'
    },
    docs_and_sheets: {
      description: 'Google Dokümanlar ve E-Tablolar belgeleri oluşturur, veri satırları ekler ve özetler.',
      trigger: 'doküman oluştur, tabloya ekle',
      action: 'workspace_manage'
    }
  }
};

export function loadMemory(): MemoryStore {
  try {
    const raw = localStorage.getItem(MEMORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_MEMORY, ...parsed };
    }
  } catch {
    // Return default
  }
  return DEFAULT_MEMORY;
}

export function saveMemory(mem: MemoryStore) {
  try {
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(mem));
  } catch {
    // Ignore error
  }
}

export function updateMemory(updates: Record<string, any>) {
  const current = loadMemory();
  for (const [cat, items] of Object.entries(updates)) {
    if (!current[cat]) {
      current[cat] = {};
    }
    if (typeof items === 'object' && items !== null) {
      current[cat] = { ...current[cat], ...items };
    } else {
      current[cat] = items;
    }
  }
  saveMemory(current);
}

function normalizeText(text: string): string {
  return (text || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/\s+/g, ' ');
}

function tokenizeText(text: string): string[] {
  return normalizeText(text).split(/[^a-z0-9]+/).filter(Boolean);
}

function entryMatches(needle: string, category: string, key: string, val: any): boolean {
  const valText = typeof val === 'object' && val !== null ? (val.value || JSON.stringify(val)) : String(val);
  const haystacks = [
    normalizeText(category),
    normalizeText(key),
    normalizeText(valText)
  ];

  if (haystacks.some(h => h.includes(needle))) {
    return true;
  }

  const tokens = tokenizeText(needle).filter(t => t.length >= 3);
  if (tokens.length === 0) return false;

  const entryTokens: string[] = [];
  for (const hay of haystacks) {
    entryTokens.push(...tokenizeText(hay));
  }

  let matched = 0;
  for (const tok of tokens) {
    if (entryTokens.some(et => et.includes(tok) || tok.includes(et))) {
      matched++;
    }
  }

  if (tokens.length === 1) return matched === 1;
  return matched >= Math.min(2, tokens.length);
}

export function deleteMemory(category: string = '', key: string = '', matchText: string = ''): string {
  const mem = loadMemory();
  const catTrim = category.trim();
  const keyTrim = key.trim();
  const needle = normalizeText(matchText || key);

  if (catTrim && keyTrim) {
    const bucket = mem[catTrim];
    if (bucket && typeof bucket === 'object' && keyTrim in bucket) {
      delete bucket[keyTrim];
      saveMemory(mem);
      return `${catTrim}/${keyTrim} hafızadan kaldırıldı.`;
    }
    return 'Bu hafıza kaydını bulamadım.';
  }

  if (!needle) {
    return 'Silmek için category/key veya match_text gerekli.';
  }

  for (const [cat, bucket] of Object.entries(mem)) {
    if (typeof bucket !== 'object' || bucket === null) continue;
    for (const [itemKey, itemVal] of Object.entries(bucket)) {
      if (entryMatches(needle, cat, itemKey, itemVal)) {
        delete (bucket as Record<string, any>)[itemKey];
        saveMemory(mem);
        return `${cat}/${itemKey} hafızadan kaldırıldı.`;
      }
    }
  }

  return 'Eşleşen bir hafıza kaydı bulamadım.';
}

export function formatMemoryForPrompt(memory: MemoryStore): string {
  const lines: string[] = ['[KULLANICI HAKKINDA BİLGİLER VE ÖĞRENİLEN BECERİLER]'];
  let count = 0;

  for (const [category, items] of Object.entries(memory)) {
    if (typeof items === 'object' && items !== null) {
      for (const [key, val] of Object.entries(items)) {
        count++;
        if (category === 'whatsapp_contacts' && typeof val === 'object' && val !== null) {
          const disp = val.display_name || key;
          const phone = val.value || '';
          const aliases = Array.isArray(val.aliases) && val.aliases.length > 0 ? ` aliases=${val.aliases.join(', ')}` : '';
          lines.push(`  ${category}/${disp}: ${phone}${aliases}`);
        } else if (category === 'learned_skills' && typeof val === 'object' && val !== null) {
          lines.push(`  learned_skill/${key}: tetikleyici="${val.trigger}", eylem="${val.description}"`);
        } else {
          const valueText = typeof val === 'object' && val !== null ? val.value : val;
          lines.push(`  ${category}/${key}: ${valueText}`);
        }
      }
    }
  }

  return count > 0 ? lines.join('\n') : '';
}

// App config helpers
export function loadAppConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Default
  }
  return {
    gemini_api_key: '',
    youtube_api_key: '',
    youtube_channel_handle: '@alpunlu',
    voice: 'Charon',
    sfx_enabled: true,
    fx_volume: 25,
    auto_speech_reply: true,
    active_platform: 'macOS'
  };
}

export function saveAppConfig(cfg: Partial<AppConfig>) {
  try {
    const current = loadAppConfig();
    const updated = { ...current, ...cfg };
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return loadAppConfig();
  }
}

// Learned Patterns
export function loadLearnedPatterns(): LearnedPattern[] {
  try {
    const raw = localStorage.getItem(LEARNED_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Default
  }
  return [
    {
      id: 'lp-1',
      category: 'preference',
      key: 'direct_play',
      value: 'Kullanıcı şarkı aç dediğinde manuel tıklama yerine doğrudan kesintisiz oynatılmasını istiyor.',
      confidence: 1.0,
      learnedAt: '2026-10-31 17:05'
    },
    {
      id: 'lp-2',
      category: 'routine',
      key: 'workspace_automation',
      value: 'Gmail, Google Docs ve E-Tablolar verilerinin sesli asistanla doğrudan yönetilmesi gerekiyor.',
      confidence: 0.98,
      learnedAt: '2026-10-31 17:06'
    },
    {
      id: 'lp-3',
      category: 'skill',
      key: 'cross_platform_sync',
      value: 'macOS DMG ve Windows uygulamaları arasında entegre bulut/yerel hafıza eşitlemesi.',
      confidence: 0.95,
      learnedAt: '2026-10-31 17:07'
    }
  ];
}

export function saveLearnedPattern(category: LearnedPattern['category'], key: string, value: string) {
  const current = loadLearnedPatterns();
  const existingIndex = current.findIndex(p => p.key === key && p.category === category);
  const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');

  if (existingIndex >= 0) {
    current[existingIndex].value = value;
    current[existingIndex].confidence = Math.min(1.0, current[existingIndex].confidence + 0.1);
    current[existingIndex].learnedAt = nowStr;
  } else {
    current.unshift({
      id: `lp-${Date.now()}`,
      category,
      key,
      value,
      confidence: 0.92,
      learnedAt: nowStr
    });
  }

  try {
    localStorage.setItem(LEARNED_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Ignore
  }

  // Also sync to memory store
  updateMemory({
    learned_skills: {
      [key]: {
        description: value,
        trigger: key,
        action: category
      }
    }
  });

  return current;
}

// Emails
export function loadEmails(): EmailMessage[] {
  try {
    const raw = localStorage.getItem(EMAILS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Default
  }
  return [
    {
      id: 'mail-1',
      to: 'ekip@maestroai.dev',
      subject: 'JARVIS 3.0 Sesli Çekirdek Güncellemesi',
      body: 'Yeni direkt YouTube ve Google Workspace entegrasyonu tamamlandı. Testler başlatılabilir.',
      date: 'Bugün, 16:45',
      status: 'sent'
    }
  ];
}

export function saveEmail(to: string, subject: string, body: string, status: 'sent' | 'draft' = 'sent'): EmailMessage {
  const emails = loadEmails();
  const newEmail: EmailMessage = {
    id: `mail-${Date.now()}`,
    to,
    subject,
    body,
    date: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    status
  };
  emails.unshift(newEmail);
  try {
    localStorage.setItem(EMAILS_STORAGE_KEY, JSON.stringify(emails));
  } catch {
    // Ignore
  }
  return newEmail;
}

// Google Workspace Docs & Sheets
export function loadWorkspaceDocs(): WorkspaceDoc[] {
  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Default
  }
  return [
    {
      id: 'doc-1',
      type: 'doc',
      title: 'JARVIS v3 Architecture Plan',
      content: 'macOS DMG & Windows desktop client, direct WebAudio integration, continuous memory learning loop, Google Workspace live proxy.',
      updated_at: 'Bugün, 16:50'
    },
    {
      id: 'doc-2',
      type: 'sheet',
      title: 'Proje Görevleri ve Yol Haritası',
      content: 'Görev | Durum | Öncelik\nSes Tanıma (STT) | Aktif | Yüksek\nDirekt YouTube Oynatma | Aktif | Yüksek\nGmail Entegrasyonu | Aktif | Yüksek\nGoogle Docs / E-Tablolar | Aktif | Yüksek\nWindows / macOS Entegrasyonu | Hazır | Yüksek',
      updated_at: 'Bugün, 17:02'
    }
  ];
}

export function saveWorkspaceDoc(title: string, content: string, type: 'doc' | 'sheet' = 'doc'): WorkspaceDoc {
  const docs = loadWorkspaceDocs();
  const newDoc: WorkspaceDoc = {
    id: `ws-${Date.now()}`,
    type,
    title,
    content,
    updated_at: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  };
  docs.unshift(newDoc);
  try {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(docs));
  } catch {
    // Ignore
  }
  return newDoc;
}

// Calendar & Reminders persistence helpers
export function loadCalendarEvents() {
  try {
    const raw = localStorage.getItem(CALENDAR_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Default
  }
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const tomorrow = new Date(now.getTime() + 86400000);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  return [
    {
      id: 'cal-1',
      title: 'JARVIS macOS & Windows Entegrasyon Toplantısı',
      start_iso: `${todayStr}T14:00`,
      end_iso: `${todayStr}T15:00`,
      location: 'Mac Studio & Windows Hub',
      calendar_name: 'İş',
      all_day: false
    },
    {
      id: 'cal-2',
      title: 'Google Workspace Canlı Testleri',
      start_iso: `${tomorrowStr}T11:30`,
      end_iso: `${tomorrowStr}T12:30`,
      location: 'Google Docs / Sheets',
      calendar_name: 'Proje',
      all_day: false
    }
  ];
}

export function saveCalendarEvents(events: any[]) {
  try {
    localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(events));
  } catch {
    // Ignore
  }
}

export function loadReminders() {
  try {
    const raw = localStorage.getItem(REMINDERS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Default
  }
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  return [
    {
      id: 'rem-1',
      title: 'YouTube ve Spotify direkt ses çalma protokolünü test et',
      due_iso: `${todayStr}T18:00`,
      list_name: 'Sesli Asistan',
      priority: 'high',
      completed: false
    },
    {
      id: 'rem-2',
      title: 'E-posta otomatik gönderim testlerini kontrol et',
      due_iso: `${todayStr}T20:00`,
      list_name: 'Workspace',
      priority: 'medium',
      completed: false
    }
  ];
}

export function saveReminders(reminders: any[]) {
  try {
    localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(reminders));
  } catch {
    // Ignore
  }
}
