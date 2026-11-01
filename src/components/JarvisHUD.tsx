// Master JARVIS Holographic HUD Canvas & Interface

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  JarvisState,
  LogMessage,
  DebugLog,
  SystemStats,
  WeatherCard,
  HealthSummary,
  ActiveMediaState,
  AppConfig
} from '../types';
import { soundManager } from '../services/soundManager';
import {
  loadAppConfig,
  saveAppConfig,
  loadLearnedPatterns,
  loadEmails,
  loadWorkspaceDocs,
  loadMemory
} from '../services/memoryManager';
import { processUserMessage, VoiceRecognizer, speakText, stopSpeaking } from '../services/aiService';

const VOICES = ["Charon", "Puck", "Aoede", "Kore", "Fenrir", "Leda", "Orus", "Zephyr"];

export const JarvisHUD: React.FC = () => {
  // State
  const [jarvisState, setJarvisState] = useState<JarvisState>('LISTENING');
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeTab, setActiveTab] = useState<'hud' | 'workspace' | 'learning'>('hud');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'settings' | 'debug'>('settings');
  const [apiModalOpen, setApiModalOpen] = useState(false);

  // App configuration
  const [config, setConfig] = useState<AppConfig>(loadAppConfig());
  const [logs, setLogs] = useState<LogMessage[]>([
    {
      id: 'init-1',
      sender: 'sys',
      text: 'JARVIS Voice Core v3.0 macOS & Windows başlatıldı. Tüm sensörler devrede.',
      timestamp: new Date().toLocaleTimeString('tr-TR')
    },
    {
      id: 'init-2',
      sender: 'jarvis',
      text: 'Sizi dinliyorum efendim. Müzik çalma, YouTube arama, e-posta gönderme ve Google Workspace emirlerinize hazırım.',
      timestamp: new Date().toLocaleTimeString('tr-TR')
    }
  ]);
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [inputText, setInputText] = useState('');
  const [activeMedia, setActiveMedia] = useState<ActiveMediaState | null>(null);

  // System stats
  const [stats, setStats] = useState<SystemStats>({
    cpu: 18.2,
    ram: 44.5,
    disk: 41.2,
    battery: 96,
    net_up: 124.5,
    net_down: 840.2,
    cpu_hist: [14, 18, 16, 22, 19, 24, 20, 18, 15, 19, 21, 18, 16, 20, 22, 17, 19, 21, 18, 16, 20, 18, 17, 19],
    uptimeSeconds: 1420
  });

  // Weather card
  const [weather, setWeather] = useState<WeatherCard>({
    city: 'Istanbul',
    primary: '19°C',
    details: ['Parçalı bulutlu', 'Hissedilen 19°C', 'Nem %58', 'Rüzgar 14 km/s KB']
  });

  // Health summary
  const [health] = useState<HealthSummary>({
    heart_rate: 72,
    resting_hr: 58,
    hrv: 64,
    walking_hr: 94,
    blood_oxygen: 98.5,
    respiratory_rate: 14.2,
    steps: 8420,
    calories: 540,
    basal_calories: 1820,
    exercise_min: 42,
    stand_hours: 9,
    stand_min: 52,
    walking_distance_km: 6.2,
    walking_speed: 4.8,
    walking_step_length_cm: 72,
    headphone_audio_db: 58.4,
    daylight_min: 68,
    sleep_hours: 7.4,
    flights_climbed: 8,
    updated_age: 'az önce'
  });

  // Highlight/focus tracking for left panel cards
  const [focusPanel, setFocusPanel] = useState<string>('');

  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const recognizerRef = useRef<VoiceRecognizer | null>(null);

  // Log helpers
  const appendLog = useCallback((sender: LogMessage['sender'], text: string, toolCallName?: string) => {
    const newMsg: LogMessage = {
      id: `log-${Date.now()}-${Math.random()}`,
      sender,
      text,
      timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      toolCallName
    };
    setLogs(prev => [...prev.slice(-150), newMsg]);
  }, []);

  const appendDebug = useCallback((level: DebugLog['level'], message: string) => {
    const newDebug: DebugLog = {
      id: `dbg-${Date.now()}-${Math.random()}`,
      level,
      message,
      timestamp: new Date().toLocaleTimeString('tr-TR')
    };
    setDebugLogs(prev => [newDebug, ...prev.slice(0, 80)]);
  }, []);

  // Submit User Message
  const handleUserMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (isPaused) {
      appendLog('sys', 'JARVIS duraklatılmış durumda. Devam etmek için pause butonuna veya küreye tıklayın.');
      return;
    }

    appendLog('you', trimmed);
    setInputText('');
    setJarvisState('THINKING');
    soundManager.startThinking();

    try {
      const response = await processUserMessage(trimmed, (toolName) => {
        appendDebug('INFO', `Araç çalıştırılıyor: ${toolName}`);
      });

      soundManager.stopThinking();

      // Tool result logs
      for (const tr of response.toolResults) {
        if (tr.playSuccessSfx) {
          soundManager.playSuccess();
        } else if (tr.isError) {
          soundManager.playError();
        }

        if (tr.panelFocus) {
          setFocusPanel(tr.panelFocus);
          setTimeout(() => setFocusPanel(''), 6000);
        }

        if (tr.activeMedia) {
          setActiveMedia(tr.activeMedia);
        }
      }

      setJarvisState('SPEAKING');
      appendLog('jarvis', response.replyText);

      // Voice output
      if (config.auto_speech_reply && !isMuted) {
        speakText(response.replyText, () => {
          setJarvisState('LISTENING');
        });
      } else {
        setTimeout(() => {
          setJarvisState('LISTENING');
        }, 1500);
      }
    } catch (err: any) {
      soundManager.stopThinking();
      soundManager.playError();
      setJarvisState('ERROR');
      appendLog('err', `Hata: ${err?.message || err}`);
      appendDebug('ERROR', String(err?.message || err));
      setTimeout(() => setJarvisState('LISTENING'), 4000);
    }
  }, [isPaused, isMuted, config.auto_speech_reply, appendLog, appendDebug]);

  // Voice Recognizer initialization
  useEffect(() => {
    const rec = new VoiceRecognizer();
    recognizerRef.current = rec;

    rec.setCallbacks(
      (transcript) => {
        if (!isMuted && !isPaused) {
          handleUserMessage(transcript);
        }
      },
      (err) => {
        appendDebug('WARN', `Mikrofon: ${err}`);
      },
      (listening) => {
        if (listening && !isPaused && !isMuted) {
          setJarvisState('LISTENING');
        }
      }
    );

    // Initial startup sound
    setTimeout(() => {
      soundManager.playStartup();
    }, 400);

    return () => {
      rec.stop();
      soundManager.stopAll();
      stopSpeaking();
    };
  }, []);

  // Keep log scrolled to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Keyboard shortcuts [F4: Mute, F5: Pause, ESC: Clear/Stop, Enter: Submit]
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F4') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'F5') {
        e.preventDefault();
        togglePause();
      } else if (e.key === 'Escape') {
        stopSpeaking();
        soundManager.stopAll();
        setJarvisState('LISTENING');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMuted, isPaused]);

  // System stats ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => {
        const nextCpu = Math.max(8, Math.min(65, prev.cpu + (Math.random() * 6 - 3)));
        const newHist = [...prev.cpu_hist.slice(1), nextCpu];
        return {
          ...prev,
          cpu: nextCpu,
          cpu_hist: newHist,
          net_up: Math.max(10, prev.net_up + (Math.random() * 40 - 20)),
          net_down: Math.max(50, prev.net_down + (Math.random() * 100 - 50)),
          uptimeSeconds: prev.uptimeSeconds + 1
        };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Weather once
  useEffect(() => {
    fetch('https://wttr.in/Istanbul?format=j1')
      .then(r => r.json())
      .then(d => {
        const curr = d.current_condition?.[0] || {};
        const temp = curr.temp_C ? `${curr.temp_C}°C` : '19°C';
        const desc = curr.weatherDesc?.[0]?.value || 'Güneşli';
        setWeather({
          city: 'Istanbul',
          primary: temp,
          details: [
            desc,
            `Hissedilen ${curr.FeelsLikeC || curr.temp_C}°C`,
            `Nem %${curr.humidity || 55}`,
            `Rüzgar ${curr.windspeedKmph || 14} km/s`
          ]
        });
      })
      .catch(() => {});
  }, []);

  // Toggles
  const toggleMute = () => {
    setIsMuted(prev => {
      const next = !prev;
      if (next) {
        recognizerRef.current?.stop();
        stopSpeaking();
        appendLog('sys', 'Mikrofon sessize alındı [MUTED].');
      } else {
        recognizerRef.current?.start();
        appendLog('sys', 'Mikrofon aktif [LIVE]. Dinliyorum...');
      }
      return next;
    });
  };

  const togglePause = () => {
    setIsPaused(prev => {
      const next = !prev;
      if (next) {
        setJarvisState('PAUSED');
        stopSpeaking();
        soundManager.stopAmbient();
        appendLog('sys', 'JARVIS duraklatıldı.');
      } else {
        setJarvisState('LISTENING');
        if (config.sfx_enabled) soundManager.startAmbient();
        appendLog('sys', 'JARVIS devam ediyor...');
      }
      return next;
    });
  };

  // --------------------------------------------------------------------------
  // Canvas rendering of authentic Concentric Rings & Particle Swarm
  // --------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let tick = 0;
    const ringsSpin = [0, 45, 90, 200];
    let pulseRings: number[] = [];

    // Particle Swarm
    const orbParticles = Array.from({ length: 160 }, () => ({
      angle: Math.random() * Math.PI * 2,
      orbit: 0.08 + Math.random() * 0.90,
      speed: (Math.random() - 0.5) * 0.05,
      size: 0.8 + Math.random() * 2.2,
      phase: Math.random() * Math.PI * 2,
      wobble: 0.01 + Math.random() * 0.03,
      depth: 0.3 + Math.random() * 0.7
    }));

    const shellParticles = Array.from({ length: 84 }, () => ({
      angle: Math.random() * Math.PI * 2,
      speed: (Math.random() - 0.5) * 0.035,
      size: 1.4 + Math.random() * 2.4,
      phase: Math.random() * Math.PI * 2,
      glow: 0.4 + Math.random() * 0.6
    }));

    // Ambient floating dust
    const ambientDust = Array.from({ length: 28 }, () => ({
      x: Math.random() * 1200,
      y: Math.random() * 800,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      r: 0.8 + Math.random() * 1.5,
      alpha: 0.1 + Math.random() * 0.4
    }));

    const render = () => {
      tick++;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2 - 20;
      const faceR = Math.min(w * 0.42, h * 0.44, 260);

      // State-based color RGB
      let rgb = [0, 212, 192]; // Teal default
      if (isPaused) {
        rgb = [30, 60, 55];
      } else if (isMuted) {
        rgb = [200, 30, 80];
      } else if (jarvisState === 'LISTENING') {
        rgb = [0, 255, 136];
      } else if (jarvisState === 'SPEAKING') {
        rgb = [68, 136, 255];
      } else if (jarvisState === 'THINKING') {
        rgb = [255, 204, 0];
      } else if (jarvisState === 'ERROR') {
        rgb = [255, 51, 68];
      }

      // Background subtle dot grid
      ctx.fillStyle = '#061414';
      for (let x = 0; x < w; x += 40) {
        for (let y = 0; y < h; y += 40) {
          ctx.fillRect(x, y, 1, 1);
        }
      }

      // Scanline beam
      const scanY = (tick * 0.8) % (h + 40);
      ctx.strokeStyle = 'rgba(0, 212, 192, 0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(w, scanY + 25);
      ctx.stroke();

      // Ambient Dust
      for (const d of ambientDust) {
        d.x = (d.x + d.vx + w) % w;
        d.y = (d.y + d.vy + h) % h;
        ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${d.alpha * 0.3})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Expanding pulse rings
      const pulseSpeed = jarvisState === 'SPEAKING' ? 3.5 : 1.6;
      pulseRings = pulseRings.map(r => r + pulseSpeed).filter(r => r < faceR * 1.5);
      if (pulseRings.length < 3 && Math.random() < (jarvisState === 'SPEAKING' ? 0.08 : 0.02)) {
        pulseRings.push(faceR * 0.7);
      }
      for (const pr of pulseRings) {
        const alpha = Math.max(0, 1 - pr / (faceR * 1.5)) * 0.35;
        ctx.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy, pr, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Structural concentric circle outlines
      [1.0, 0.90, 0.76, 0.62].forEach((frac, i) => {
        const rr = faceR * frac;
        ctx.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${0.12 + i * 0.04})`;
        ctx.lineWidth = i === 0 ? 1.5 : 1;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Rotating segmented arcs
      const spdMult = isPaused ? 0 : jarvisState === 'SPEAKING' ? 2.4 : jarvisState === 'THINKING' ? 1.8 : 0.8;
      ringsSpin[0] = (ringsSpin[0] + 0.012 * spdMult) % (Math.PI * 2);
      ringsSpin[1] = (ringsSpin[1] - 0.009 * spdMult) % (Math.PI * 2);
      ringsSpin[2] = (ringsSpin[2] + 0.018 * spdMult) % (Math.PI * 2);

      ctx.save();
      ctx.lineWidth = 2.5;

      // Arc 1
      ctx.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.75)`;
      ctx.beginPath();
      ctx.arc(cx, cy, faceR * 0.95, ringsSpin[0], ringsSpin[0] + 1.2);
      ctx.stroke();

      // Arc 2
      ctx.strokeStyle = `rgba(0, 212, 192, 0.85)`;
      ctx.beginPath();
      ctx.arc(cx, cy, faceR * 0.95, ringsSpin[0] + Math.PI, ringsSpin[0] + Math.PI + 0.8);
      ctx.stroke();

      // Arc 3 (inner ring)
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.6)`;
      ctx.beginPath();
      ctx.arc(cx, cy, faceR * 0.78, ringsSpin[2], ringsSpin[2] + 1.5);
      ctx.stroke();
      ctx.restore();

      // Outer Shell Particles
      const shellR = faceR * 0.92;
      for (const sp of shellParticles) {
        sp.angle += sp.speed * spdMult;
        const wobble = 1.0 + 0.04 * Math.sin(tick * 0.05 + sp.phase);
        const px = cx + Math.cos(sp.angle) * shellR * wobble;
        const py = cy + Math.sin(sp.angle) * shellR * wobble;
        ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${sp.glow * 0.7})`;
        ctx.beginPath();
        ctx.arc(px, py, sp.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Swarm Particle Vortex (160 particles with 3D squashed depth)
      const fieldR = faceR * 0.65;
      for (const p of orbParticles) {
        p.angle += p.speed * spdMult;
        const wobble = 1.0 + 0.15 * Math.sin(tick * p.wobble + p.phase);
        const orbit = fieldR * p.orbit * wobble;
        const depth = 0.5 + 0.5 * Math.sin(p.angle * 2.0 + tick * 0.02 + p.phase);
        const ySquash = 0.65 + depth * 0.35;
        const px = cx + Math.cos(p.angle) * orbit;
        const py = cy + Math.sin(p.angle) * orbit * ySquash;
        const alpha = Math.min(1.0, (0.2 + depth * 0.7) * p.depth);

        ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, p.size * (0.8 + depth * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }

      // Inner Core Void
      const voidR = faceR * 0.12;
      ctx.fillStyle = '#020c0c';
      ctx.beginPath();
      ctx.arc(cx, cy, voidR, 0, Math.PI * 2);
      ctx.fill();

      // Central glowing pulse node
      const centerPulse = 0.5 + 0.5 * Math.sin(tick * 0.08);
      ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${0.4 + centerPulse * 0.4})`;
      ctx.beginPath();
      ctx.arc(cx, cy, voidR * 0.5, 0, Math.PI * 2);
      ctx.fill();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [jarvisState, isPaused, isMuted]);

  return (
    <div className="relative w-screen h-screen bg-[#020c0c] text-[#7dfff6] flex flex-col font-body select-none overflow-hidden">
      {/* ── HEADER ── */}
      <header className="h-[68px] border-b border-[#006a62]/60 bg-[#010a0a]/90 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-4">
          <div
            onClick={() => setSettingsOpen(prev => !prev)}
            className="flex items-center gap-2 border border-[#00d4c0]/50 bg-[#021010] hover:bg-[#062020] px-3.5 py-1.5 cursor-pointer transition-all"
          >
            <span className="text-[#00d4c0] font-display text-sm tracking-widest">SYSTEM SETTINGS</span>
            <span className="text-[#4f7b78] text-xs">· macOS & Windows</span>
            <span className="text-[#00d4c0] text-xs ml-1">{settingsOpen ? '▾' : '▸'}</span>
          </div>

          <div className="flex items-center gap-1 bg-[#031515] border border-[#0a2a28] p-1 text-xs">
            <button
              onClick={() => setActiveTab('hud')}
              className={`px-3 py-1 cursor-pointer transition-colors ${activeTab === 'hud' ? 'bg-[#00d4c0] text-[#020c0c] font-bold' : 'text-[#7dfff6] hover:text-[#00d4c0]'}`}
            >
              HUD CORE
            </button>
            <button
              onClick={() => setActiveTab('workspace')}
              className={`px-3 py-1 cursor-pointer transition-colors ${activeTab === 'workspace' ? 'bg-[#00d4c0] text-[#020c0c] font-bold' : 'text-[#7dfff6] hover:text-[#00d4c0]'}`}
            >
              WORKSPACE & MAILS
            </button>
            <button
              onClick={() => setActiveTab('learning')}
              className={`px-3 py-1 cursor-pointer transition-colors ${activeTab === 'learning' ? 'bg-[#00d4c0] text-[#020c0c] font-bold' : 'text-[#7dfff6] hover:text-[#00d4c0]'}`}
            >
              ÖĞRENME MERKEZİ
            </button>
          </div>
        </div>

        <div className="text-center">
          <h1 className="font-display text-2xl tracking-[0.25em] text-[#00d4c0] drop-shadow-[0_0_12px_rgba(0,212,192,0.5)]">
            J.A.R.V.I.S
          </h1>
          <p className="text-[10px] tracking-wider text-[#006a62]">
            Just A Rather Very Intelligent System · Core Orchestrator
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 border border-[#0a2a28] bg-[#030f0f] px-3 py-1">
            <span
              className={`w-2 h-2 rounded-full animate-pulse ${
                isPaused ? 'bg-[#006a62]' :
                jarvisState === 'LISTENING' ? 'bg-[#00ff88]' :
                jarvisState === 'SPEAKING' ? 'bg-[#4488ff]' :
                jarvisState === 'THINKING' ? 'bg-[#ffcc00]' : 'bg-[#ff3344]'
              }`}
            />
            <span className="text-xs font-bold tracking-wider text-[#7dfff6]">
              {isPaused ? 'PAUSED' : isMuted ? 'MUTED' : jarvisState}
            </span>
          </div>

          <button
            onClick={() => setApiModalOpen(true)}
            className="border border-[#4488ff]/60 text-[#4488ff] hover:bg-[#4488ff]/10 text-xs px-3 py-1.5 cursor-pointer font-bold transition-all"
          >
            ⌘ API SETTINGS
          </button>
        </div>
      </header>

      {/* ── MAIN INTERFACE ── */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* LEFT PANEL: Holographic Monitoring Cards */}
        <aside className="w-[340px] shrink-0 border-r border-[#006a62]/40 bg-[#030f0f]/80 p-3.5 flex flex-col gap-3 overflow-y-auto z-20">
          {/* Card 1: TIME */}
          <div className={`p-3.5 border transition-all ${focusPanel === 'time' ? 'border-[#ffcc00] bg-[#ffcc00]/10 shadow-[0_0_15px_rgba(255,204,0,0.3)]' : 'border-[#006a62]/50 bg-[#020e0e]'}`}>
            <div className="flex justify-between items-center text-[11px] text-[#00d4c0] font-display border-b border-[#0a2a28] pb-1.5 mb-2">
              <span>TIME & DATE</span>
              <span className="text-[#006a62]">UTC+3</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl text-[#00d4c0]">
                {new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-sm font-bold text-[#006a62]">
                :{new Date().toLocaleTimeString('tr-TR', { second: '2-digit' })}
              </span>
            </div>
            <div className="text-xs text-[#ffcc00] font-bold mt-1 uppercase">
              {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div className="text-[11px] text-[#7dfff6]/70 uppercase">
              {new Date().toLocaleDateString('tr-TR', { weekday: 'long' })}
            </div>
          </div>

          {/* Card 2: WEATHER */}
          <div className={`p-3.5 border transition-all ${focusPanel === 'weather' ? 'border-[#00ff88] bg-[#00ff88]/10 shadow-[0_0_15px_rgba(0,255,136,0.3)]' : 'border-[#006a62]/50 bg-[#020e0e]'}`}>
            <div className="flex justify-between items-center text-[11px] text-[#00d4c0] font-display border-b border-[#0a2a28] pb-1.5 mb-2">
              <span>WEATHER · {weather.city.toUpperCase()}</span>
              <span className="text-xs text-[#00ff88]">LIVE</span>
            </div>
            <div className="font-display text-2xl text-[#00d4c0] mb-1">
              {weather.primary}
            </div>
            <div className="space-y-0.5 text-xs text-[#7dfff6]/80">
              {weather.details.map((line, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-[#00d4c0]">·</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3: SYSTEM STATUS */}
          <div className={`p-3.5 border transition-all ${focusPanel === 'system' ? 'border-[#4488ff] bg-[#4488ff]/10 shadow-[0_0_15px_rgba(68,136,255,0.3)]' : 'border-[#006a62]/50 bg-[#020e0e]'}`}>
            <div className="flex justify-between items-center text-[11px] text-[#00d4c0] font-display border-b border-[#0a2a28] pb-1.5 mb-2">
              <span>SYSTEM DIAGNOSTICS</span>
              <span className="text-[10px] text-[#006a62]">macOS / WIN</span>
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <div className="flex justify-between mb-0.5">
                  <span className="text-[#006a62]">CPU USAGE</span>
                  <span className="font-bold text-[#00d4c0]">{stats.cpu.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-[#071818] h-1.5 rounded-none overflow-hidden">
                  <div className="bg-[#00d4c0] h-full transition-all duration-300" style={{ width: `${stats.cpu}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-0.5">
                  <span className="text-[#006a62]">RAM ACTIVE</span>
                  <span className="font-bold text-[#00d4c0]">{stats.ram.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-[#071818] h-1.5 rounded-none overflow-hidden">
                  <div className="bg-[#4488ff] h-full transition-all duration-300" style={{ width: `${stats.ram}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-0.5">
                  <span className="text-[#006a62]">BATTERY</span>
                  <span className="font-bold text-[#00ff88]">{stats.battery}%</span>
                </div>
                <div className="w-full bg-[#071818] h-1.5 rounded-none overflow-hidden">
                  <div className="bg-[#00ff88] h-full" style={{ width: `${stats.battery}%` }} />
                </div>
              </div>

              <div className="pt-1 flex justify-between text-[11px] border-t border-[#0a2a28]">
                <span className="text-[#ff9900]">▲ {(stats.net_up).toFixed(1)} KB/s</span>
                <span className="text-[#00ff88]">▼ {(stats.net_down).toFixed(1)} KB/s</span>
              </div>
            </div>
          </div>

          {/* Card 4: HEALTH SUMMARY */}
          <div className="p-3.5 border border-[#006a62]/50 bg-[#020e0e] text-xs space-y-1.5">
            <div className="flex justify-between items-center text-[11px] text-[#00d4c0] font-display border-b border-[#0a2a28] pb-1.5 mb-2">
              <span>HEALTH BIOMETRICS</span>
              <span className="text-[10px] text-[#ff6600]">SYNCED</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-[#006a62]">Nabız:</span> <span className="font-bold text-[#00d4c0]">{health.heart_rate} bpm</span>
              </div>
              <div>
                <span className="text-[#006a62]">HRV:</span> <span className="font-bold text-[#00d4c0]">{health.hrv} ms</span>
              </div>
              <div>
                <span className="text-[#006a62]">Adım:</span> <span className="font-bold text-[#ffcc00]">{health.steps.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[#006a62]">Aktif:</span> <span className="font-bold text-[#00ff88]">{health.calories} kcal</span>
              </div>
              <div>
                <span className="text-[#006a62]">Uyku:</span> <span className="font-bold text-[#4488ff]">{health.sleep_hours} saat</span>
              </div>
              <div>
                <span className="text-[#006a62]">Kardiyo:</span> <span className="font-bold text-[#00d4c0]">{health.exercise_min} dk</span>
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER AREA: Visualizer Canvas OR Workspace Views */}
        <section className="flex-1 relative flex flex-col items-center justify-between p-4 overflow-hidden">
          {activeTab === 'hud' && (
            <>
              {/* Canvas Orb with interactive pause/resume click */}
              <div
                className="relative flex-1 w-full flex items-center justify-center cursor-pointer"
                onClick={togglePause}
                title="Küreye tıklayarak duraklatabilir veya devam ettirebilirsiniz"
              >
                <canvas
                  ref={canvasRef}
                  width={900}
                  height={620}
                  className="max-w-full max-h-full object-contain"
                />

                {/* Subtitle / State Indicator beneath orb */}
                <div className="absolute bottom-6 flex flex-col items-center pointer-events-none">
                  <div className="text-[#7dfff6] font-display text-lg tracking-[0.2em] drop-shadow-[0_0_8px_rgba(0,212,192,0.6)]">
                    JARVIS VOICE CORE
                  </div>
                  <div
                    className="text-xs font-bold tracking-widest uppercase mt-1"
                    style={{
                      color: isPaused ? '#006a62' :
                             jarvisState === 'LISTENING' ? '#00ff88' :
                             jarvisState === 'SPEAKING' ? '#4488ff' :
                             jarvisState === 'THINKING' ? '#ffcc00' : '#ff3344'
                    }}
                  >
                    ● {isPaused ? 'DURAKLATILDI' : isMuted ? 'MİKROFON KAPALI' : jarvisState}
                  </div>
                </div>
              </div>

              {/* In-HUD Embedded Direct YouTube Player */}
              {activeMedia && (
                <div className="w-[520px] max-w-full bg-[#031515] border border-[#00d4c0] p-3 shadow-[0_0_25px_rgba(0,212,192,0.3)] z-30 mb-2">
                  <div className="flex justify-between items-center text-xs pb-1.5 border-b border-[#006a62] mb-2 font-display">
                    <span className="text-[#00d4c0] flex items-center gap-2">
                      <span className="animate-spin text-sm">💿</span> DOĞRUDAN OYNATMA: {activeMedia.title}
                    </span>
                    <button
                      onClick={() => setActiveMedia(null)}
                      className="text-[#ff3344] hover:text-white px-2 cursor-pointer font-bold"
                    >
                      ✕ KAPAT
                    </button>
                  </div>
                  <div className="aspect-video w-full bg-black relative overflow-hidden border border-[#0a2a28]">
                    <iframe
                      src={`https://www.youtube.com/embed/${activeMedia.videoId}?autoplay=1&enablejsapi=1`}
                      title="Direct HUD Media Player"
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-[#006a62] mt-2">
                    <span>JARVIS Otomatik Oynatma Modu</span>
                    <span className="text-[#00ff88]">KESİNTİSİZ SES</span>
                  </div>
                </div>
              )}

              {/* Bottom Control Buttons */}
              <div className="flex items-center gap-3 shrink-0 py-2 z-20">
                <button
                  onClick={toggleMute}
                  className={`px-5 py-2.5 text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
                    isMuted ? 'border-[#cc2255] text-[#cc2255] bg-[#cc2255]/10' : 'border-[#00ff88] text-[#00ff88] bg-[#00ff88]/10 hover:bg-[#00ff88]/20'
                  }`}
                >
                  <span>{isMuted ? '🔇' : '🎙'}</span>
                  <span>{isMuted ? 'MUTED' : 'LIVE'}</span>
                </button>

                <button
                  onClick={togglePause}
                  className={`px-5 py-2.5 text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
                    isPaused ? 'border-[#ffcc00] text-[#ffcc00] bg-[#ffcc00]/10' : 'border-[#4488ff] text-[#4488ff] bg-[#4488ff]/10 hover:bg-[#4488ff]/20'
                  }`}
                >
                  <span>{isPaused ? '▶' : '⏸'}</span>
                  <span>{isPaused ? 'RESUME' : 'PAUSE'}</span>
                </button>

                <button
                  onClick={() => {
                    soundManager.playError();
                    appendLog('sys', 'JARVIS oturumu sıfırlandı.');
                    setActiveMedia(null);
                  }}
                  className="px-5 py-2.5 text-xs font-bold border border-[#ff3344] text-[#ff3344] bg-[#ff3344]/10 hover:bg-[#ff3344]/20 transition-all cursor-pointer flex items-center gap-2"
                >
                  <span>⏻</span>
                  <span>RESET</span>
                </button>
              </div>
            </>
          )}

          {/* WORKSPACE & GOOGLE DOCS VIEW */}
          {activeTab === 'workspace' && (
            <div className="w-full h-full flex flex-col p-4 overflow-y-auto space-y-4">
              <div className="flex justify-between items-center border-b border-[#006a62] pb-2">
                <h2 className="font-display text-lg text-[#00d4c0]">GOOGLE WORKSPACE & GMAIL MERKEZİ</h2>
                <span className="text-xs text-[#00ff88]">ÇEVRİMİÇİ SENKRON</span>
              </div>

              {/* Workspace Quick Actions */}
              <div className="grid grid-cols-3 gap-3">
                <div
                  onClick={() => handleUserMessage('Yeni proje dokümanı oluştur')}
                  className="p-3 border border-[#00d4c0]/40 bg-[#021414] hover:border-[#00d4c0] cursor-pointer"
                >
                  <div className="font-bold text-sm text-[#00d4c0] mb-1">📄 Yeni Google Doc</div>
                  <div className="text-xs text-[#7dfff6]/70">Sesli komutla anında doküman açıp yazdırın.</div>
                </div>
                <div
                  onClick={() => handleUserMessage('E-Tabloya yeni görev satırı ekle')}
                  className="p-3 border border-[#00d4c0]/40 bg-[#021414] hover:border-[#00d4c0] cursor-pointer"
                >
                  <div className="font-bold text-sm text-[#00ff88] mb-1">📊 E-Tabloya Satır Ekle</div>
                  <div className="text-xs text-[#7dfff6]/70">Sheets üzerine canlı metrik ve kayıt ekleyin.</div>
                </div>
                <div
                  onClick={() => handleUserMessage('ekip@maestro.ai adresine test maili gönder')}
                  className="p-3 border border-[#00d4c0]/40 bg-[#021414] hover:border-[#00d4c0] cursor-pointer"
                >
                  <div className="font-bold text-sm text-[#4488ff] mb-1">✉ Hızlı E-Posta Gönder</div>
                  <div className="text-xs text-[#7dfff6]/70">Tek cümleyle doğrudan alıcıya e-posta ulaştırın.</div>
                </div>
              </div>

              {/* Docs list */}
              <div className="border border-[#0a2a28] bg-[#020e0e] p-3">
                <div className="text-xs font-display text-[#00d4c0] border-b border-[#0a2a28] pb-1 mb-2">
                  DOKÜMANLAR VE TABLOLAR ({loadWorkspaceDocs().length})
                </div>
                <div className="space-y-2">
                  {loadWorkspaceDocs().map(doc => (
                    <div key={doc.id} className="p-2.5 border border-[#006a62]/30 bg-[#031515] flex justify-between items-start">
                      <div>
                        <div className="font-bold text-sm text-[#7dfff6]">
                          {doc.type === 'doc' ? '📄' : '📊'} {doc.title}
                        </div>
                        <div className="text-xs text-[#7dfff6]/70 mt-1 whitespace-pre-wrap">{doc.content}</div>
                      </div>
                      <span className="text-[10px] text-[#006a62]">{doc.updated_at}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sent Emails */}
              <div className="border border-[#0a2a28] bg-[#020e0e] p-3">
                <div className="text-xs font-display text-[#00d4c0] border-b border-[#0a2a28] pb-1 mb-2">
                  GÖNDERİLEN E-POSTALAR & TASLAKLAR ({loadEmails().length})
                </div>
                <div className="space-y-2">
                  {loadEmails().map(em => (
                    <div key={em.id} className="p-2.5 border border-[#006a62]/30 bg-[#031515] flex justify-between items-start">
                      <div>
                        <div className="font-bold text-xs text-[#4488ff]">Kime: {em.to} · {em.subject}</div>
                        <div className="text-xs text-[#7dfff6]/80 mt-0.5">{em.body}</div>
                      </div>
                      <span className="text-[10px] text-[#00ff88]">{em.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CONTINUOUS LEARNING HUB */}
          {activeTab === 'learning' && (
            <div className="w-full h-full flex flex-col p-4 overflow-y-auto space-y-4">
              <div className="flex justify-between items-center border-b border-[#006a62] pb-2">
                <h2 className="font-display text-lg text-[#00d4c0]">JARVIS ÖĞRENME VE ADAPTASYON MERKEZİ</h2>
                <span className="text-xs text-[#ffcc00]">AKTİF ÖĞRENME AÇIK</span>
              </div>

              <div className="p-3 border border-[#00d4c0]/40 bg-[#021212] text-xs space-y-1">
                <div className="font-bold text-[#00d4c0]">🧠 Sürekli Kişiselleştirme Motoru:</div>
                <div className="text-[#7dfff6]/80">
                  JARVIS sizin müzik tercihlerinizi, e-posta alışkanlıklarınızı, sık kullanılan rutinlerinizi ve komut kalıplarınızı sesinizden analiz edip hafızasına kaydeder.
                </div>
              </div>

              <div className="space-y-3">
                {loadLearnedPatterns().map(pattern => (
                  <div key={pattern.id} className="p-3 border border-[#006a62]/50 bg-[#020e0e] space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-display text-[#00d4c0] uppercase">{pattern.category}: {pattern.key}</span>
                      <span className="text-[#00ff88] text-[10px]">Güven: %{(pattern.confidence * 100).toFixed(0)}</span>
                    </div>
                    <div className="text-xs text-[#7dfff6]">{pattern.value}</div>
                    <div className="text-[10px] text-[#006a62]">Öğrenildi: {pattern.learnedAt}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* RIGHT PANEL: Live Conversation Typewriter & Input */}
        <aside className="w-[430px] shrink-0 border-l border-[#006a62]/40 bg-[#030d0d] flex flex-col justify-between z-20">
          <div className="p-3 border-b border-[#0a2a28] flex justify-between items-center">
            <span className="font-display text-xs text-[#00d4c0] tracking-wider">CONVERSATION LOG</span>
            <span className="text-[11px] text-[#006a62]">LIVE FEED</span>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
            {logs.map(log => (
              <div
                key={log.id}
                className={`p-2.5 rounded-none border-l-2 ${
                  log.sender === 'you' ? 'border-l-[#d0f0ee] bg-[#031515] text-[#d0f0ee]' :
                  log.sender === 'jarvis' ? 'border-l-[#00d4c0] bg-[#021818] text-[#7dfff6]' :
                  log.sender === 'err' ? 'border-l-[#ff3344] bg-[#1a0508] text-[#ff3344]' :
                  'border-l-[#ffcc00] bg-[#141203] text-[#ffcc00]'
                }`}
              >
                <div className="flex justify-between items-center text-[10px] opacity-70 mb-1">
                  <span className="font-bold uppercase tracking-wider">
                    {log.sender === 'you' ? 'Siz' : log.sender === 'jarvis' ? 'JARVIS' : log.sender === 'err' ? 'HATA' : 'SİSTEM'}
                  </span>
                  <span>{log.timestamp}</span>
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">{log.text}</div>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>

          {/* Input box */}
          <div className="p-3 border-t border-[#0a2a28] bg-[#020b0b]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUserMessage(inputText);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Sesli veya yazılı komut verin (örn. şu şarkıyı aç, mail at)..."
                className="flex-1 bg-[#041212] border border-[#0a2a28] focus:border-[#00d4c0] text-xs text-[#7dfff6] px-3 py-2 outline-none"
              />
              <button
                type="submit"
                className="bg-[#00d4c0]/10 border border-[#00d4c0] hover:bg-[#00d4c0] hover:text-[#020c0c] text-[#00d4c0] font-bold text-xs px-4 py-2 transition-all cursor-pointer font-display"
              >
                GÖNDER ▸
              </button>
            </form>
            <div className="flex justify-between items-center text-[10px] text-[#006a62] mt-2">
              <span>[Enter] Gönder · [F4] Mute · [F5] Pause</span>
              <span className="cursor-pointer hover:text-[#00d4c0]" onClick={() => setLogs([])}>
                Günlüğü Temizle
              </span>
            </div>
          </div>
        </aside>
      </main>

      {/* ── FOOTER ── */}
      <footer className="h-[28px] border-t border-[#006a62]/40 bg-[#010a0a] px-6 flex items-center justify-between text-[11px] text-[#006a62] shrink-0 z-30">
        <div className="flex items-center gap-4">
          <span>JARVIS · Realtime Voice & Automation Core</span>
          <span className="text-[#0a2a28]">|</span>
          <a
            href="https://www.instagram.com/alppunlu"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-[#00d4c0] transition-colors"
          >
            <img src="/icon/instagram.png" alt="IG" className="w-3.5 h-3.5 opacity-70 hover:opacity-100" />
            <span>@alppunlu</span>
          </a>
          <a
            href="https://www.youtube.com/@alpunlu"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-[#00d4c0] transition-colors"
          >
            <img src="/icon/youtube.png" alt="YT" className="w-3.5 h-3.5 opacity-70 hover:opacity-100" />
            <span>YouTube</span>
          </a>
        </div>

        <div className="flex items-center gap-3">
          <span>Platform: {config.active_platform}</span>
          <span>·</span>
          <span>Voice: {config.voice}</span>
        </div>
      </footer>

      {/* ── SYSTEM SETTINGS & DEBUG MODAL ── */}
      {settingsOpen && (
        <div className="absolute top-[76px] left-6 w-[380px] bg-[#041111] border border-[#00d4c0] shadow-[0_0_25px_rgba(0,212,192,0.25)] p-4 z-40 text-xs">
          <div className="flex justify-between items-center border-b border-[#006a62] pb-2 mb-3">
            <span className="font-display text-[#00d4c0]">SETTINGS & DIAGNOSTICS</span>
            <button onClick={() => setSettingsOpen(false)} className="text-[#006a62] hover:text-white">✕</button>
          </div>

          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setSettingsTab('settings')}
              className={`flex-1 py-1 border text-center font-bold cursor-pointer ${settingsTab === 'settings' ? 'border-[#00d4c0] bg-[#00d4c0]/20 text-[#00d4c0]' : 'border-[#0a2a28] text-[#006a62]'}`}
            >
              GENEL
            </button>
            <button
              onClick={() => setSettingsTab('debug')}
              className={`flex-1 py-1 border text-center font-bold cursor-pointer ${settingsTab === 'debug' ? 'border-[#00d4c0] bg-[#00d4c0]/20 text-[#00d4c0]' : 'border-[#0a2a28] text-[#006a62]'}`}
            >
              DEBUG ({debugLogs.length})
            </button>
          </div>

          {settingsTab === 'settings' ? (
            <div className="space-y-3">
              <div>
                <label className="text-[#006a62] block mb-1">SES KARAKTERİ</label>
                <select
                  value={config.voice}
                  onChange={(e) => {
                    const updated = saveAppConfig({ voice: e.target.value });
                    setConfig(updated);
                  }}
                  className="w-full bg-[#020e0e] border border-[#006a62] text-[#00d4c0] p-1.5 outline-none"
                >
                  {VOICES.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between text-[#006a62] mb-1">
                  <span>FX LEVEL</span>
                  <span>{config.fx_volume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={config.fx_volume}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    soundManager.setVolume(val / 100);
                    const updated = saveAppConfig({ fx_volume: val });
                    setConfig(updated);
                  }}
                  className="w-full accent-[#00d4c0]"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#0a2a28]">
                <span className="text-[#006a62]">SESLİ YANIT (TTS)</span>
                <input
                  type="checkbox"
                  checked={config.auto_speech_reply}
                  onChange={(e) => {
                    const updated = saveAppConfig({ auto_speech_reply: e.target.checked });
                    setConfig(updated);
                  }}
                  className="accent-[#00d4c0]"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#006a62]">HUD SES EFEKTLERİ</span>
                <button
                  onClick={() => {
                    const next = !config.sfx_enabled;
                    soundManager.setEnabled(next);
                    const updated = saveAppConfig({ sfx_enabled: next });
                    setConfig(updated);
                  }}
                  className={`px-3 py-1 border text-[11px] font-bold ${config.sfx_enabled ? 'border-[#00d4c0] text-[#00d4c0]' : 'border-[#006a62] text-[#006a62]'}`}
                >
                  {config.sfx_enabled ? '♪ SFX ON' : '♪ SFX OFF'}
                </button>
              </div>
            </div>
          ) : (
            <div className="h-48 overflow-y-auto font-mono text-[11px] space-y-1.5 bg-[#020a0a] p-2 border border-[#0a2a28]">
              {debugLogs.length === 0 ? (
                <div className="text-[#006a62]">Henüz kaydedilen debug kaydı yok.</div>
              ) : (
                debugLogs.map(dbg => (
                  <div key={dbg.id} className={dbg.level === 'ERROR' ? 'text-[#ff3344]' : dbg.level === 'WARN' ? 'text-[#ffcc00]' : 'text-[#7dfff6]/80'}>
                    <span className="opacity-50">[{dbg.timestamp}]</span> {dbg.level}: {dbg.message}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ── API SETTINGS MODAL ── */}
      {apiModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-[560px] max-w-full bg-[#00080d] border border-[#00d4c0] p-6 shadow-[0_0_40px_rgba(0,212,192,0.3)]">
            <h2 className="font-display text-xl text-[#00d4c0] mb-1">◈ API VE ENTEGRASYON AYARLARI</h2>
            <p className="text-xs text-[#006a62] mb-5">
              Gemini 2.5 Flash, YouTube ve Google Workspace anahtarlarınızı güncelleyin.
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-[#006a62] mb-1">GEMINI API KEY (İsteğe bağlı, girilmezse yerel akıllı motor çalışır)</label>
                <input
                  type="password"
                  defaultValue={config.gemini_api_key}
                  id="gemini_key_input"
                  placeholder="AIzaSy..."
                  className="w-full bg-[#000d12] border border-[#0a2a28] focus:border-[#00d4c0] text-[#7dfff6] p-2 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[#006a62] mb-1">YOUTUBE API KEY (İsteğe bağlı)</label>
                <input
                  type="password"
                  defaultValue={config.youtube_api_key}
                  id="youtube_key_input"
                  placeholder="AIzaSy..."
                  className="w-full bg-[#000d12] border border-[#0a2a28] focus:border-[#00d4c0] text-[#7dfff6] p-2 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[#006a62] mb-1">YOUTUBE HANDLE / KANAL</label>
                <input
                  type="text"
                  defaultValue={config.youtube_channel_handle}
                  id="youtube_handle_input"
                  placeholder="@alpunlu"
                  className="w-full bg-[#000d12] border border-[#0a2a28] focus:border-[#00d4c0] text-[#7dfff6] p-2 outline-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#0a2a28]">
                <button
                  onClick={() => setApiModalOpen(false)}
                  className="px-4 py-2 border border-[#006a62] text-[#006a62] hover:text-white"
                >
                  KAPAT
                </button>
                <button
                  onClick={() => {
                    const gKey = (document.getElementById('gemini_key_input') as HTMLInputElement)?.value || '';
                    const yKey = (document.getElementById('youtube_key_input') as HTMLInputElement)?.value || '';
                    const yHandle = (document.getElementById('youtube_handle_input') as HTMLInputElement)?.value || '';

                    const updated = saveAppConfig({
                      gemini_api_key: gKey,
                      youtube_api_key: yKey,
                      youtube_channel_handle: yHandle
                    });
                    setConfig(updated);
                    setApiModalOpen(false);
                    soundManager.playSuccess();
                    appendLog('sys', 'API ve entegrasyon ayarları başarıyla güncellendi.');
                  }}
                  className="px-6 py-2 bg-[#00d4c0]/20 border border-[#00d4c0] hover:bg-[#00d4c0] hover:text-[#020c0c] text-[#00d4c0] font-bold font-display"
                >
                  KAYDET
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
