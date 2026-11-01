export type JarvisState = 
  | 'INITIALISING'
  | 'LISTENING'
  | 'SPEAKING'
  | 'THINKING'
  | 'MUTED'
  | 'PAUSED'
  | 'ERROR';

export interface LogMessage {
  id: string;
  sender: 'you' | 'jarvis' | 'sys' | 'err';
  text: string;
  timestamp: string;
  toolCallName?: string;
}

export interface DebugLog {
  id: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  timestamp: string;
}

export interface SystemStats {
  cpu: number;
  ram: number;
  disk: number;
  battery: number;
  net_up: number;
  net_down: number;
  cpu_hist: number[];
  uptimeSeconds: number;
}

export interface WeatherCard {
  city: string;
  primary: string;
  details: string[];
}

export interface HealthSummary {
  heart_rate: number;
  resting_hr: number;
  hrv: number;
  walking_hr: number;
  blood_oxygen: number;
  respiratory_rate: number;
  steps: number;
  calories: number;
  basal_calories: number;
  exercise_min: number;
  stand_hours: number;
  stand_min: number;
  walking_distance_km: number;
  walking_speed: number;
  walking_step_length_cm: number;
  headphone_audio_db: number;
  daylight_min: number;
  sleep_hours: number;
  flights_climbed: number;
  updated_age: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start_iso: string;
  end_iso?: string;
  location?: string;
  notes?: string;
  calendar_name?: string;
  all_day?: boolean;
}

export interface ReminderItem {
  id: string;
  title: string;
  due_iso?: string;
  notes?: string;
  list_name?: string;
  priority?: 'low' | 'medium' | 'high' | number;
  all_day?: boolean;
  completed?: boolean;
}

export interface WhatsAppContact {
  display_name: string;
  phone_number: string;
  aliases?: string[];
}

export interface EmailMessage {
  id: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  status: 'sent' | 'draft';
}

export interface WorkspaceDoc {
  id: string;
  type: 'doc' | 'sheet';
  title: string;
  content: string;
  updated_at: string;
  link?: string;
}

export interface LearnedPattern {
  id: string;
  category: 'preference' | 'routine' | 'skill' | 'instruction';
  key: string;
  value: string;
  confidence: number;
  learnedAt: string;
}

export interface ActiveMediaState {
  title: string;
  artist?: string;
  provider: 'youtube' | 'spotify' | 'apple_music';
  videoId?: string;
  isPlaying: boolean;
  autoplay: boolean;
}

export interface AppConfig {
  gemini_api_key: string;
  youtube_api_key: string;
  youtube_channel_handle: string;
  voice: string;
  sfx_enabled: boolean;
  fx_volume: number;
  auto_speech_reply: boolean;
  active_platform: 'macOS' | 'Windows' | 'Cross-Platform';
}
