import { Injectable, signal } from '@angular/core';
import { Dia } from './rutinas';

export interface Sesion {
  fecha: string;
  inicio: number;
  sets: { [idEjercicio: string]: number };
}

@Injectable({ providedIn: 'root' })
export class GymService {
  readonly version = signal(0);
  readonly descansoMin = signal<number>(this.leerNum('sbb.descanso', 2));

  private ctx: AudioContext | null = null;
  private wake: any = null;

  // ---------- Descanso configurado (1 a 5 minutos) ----------
  setDescanso(min: number): void {
    const v = Math.min(5, Math.max(1, Math.round(min)));
    this.descansoMin.set(v);
    try { localStorage.setItem('sbb.descanso', String(v)); } catch {}
  }

  // ---------- Sesión por día (persiste en el dispositivo, sin BD) ----------
  private clave(dia: string): string { return `sbb.sesion.${dia}`; }

  private leerNum(clave: string, def: number): number {
    try { const v = localStorage.getItem(clave); return v ? Number(v) || def : def; } catch { return def; }
  }

  sesion(dia: string): Sesion | null {
    try {
      const raw = localStorage.getItem(this.clave(dia));
      return raw ? JSON.parse(raw) as Sesion : null;
    } catch { return null; }
  }

  private guardar(dia: string, s: Sesion): void {
    try { localStorage.setItem(this.clave(dia), JSON.stringify(s)); } catch {}
    this.version.update(v => v + 1);
  }

  iniciar(dia: string): void {
    this.guardar(dia, { fecha: this.hoy(), inicio: Date.now(), sets: {} });
  }

  reiniciar(dia: string): void {
    try { localStorage.removeItem(this.clave(dia)); } catch {}
    this.version.update(v => v + 1);
  }

  esDeHoy(dia: string): boolean {
    const s = this.sesion(dia);
    return !!s && s.fecha === this.hoy();
  }

  seriesHechas(dia: string, idEj: string): number {
    const s = this.sesion(dia);
    return s?.sets?.[idEj] ?? 0;
  }

  completarSerie(dia: string, idEj: string, totalSeries: number): void {
    let s = this.sesion(dia);
    if (!s) { this.iniciar(dia); s = this.sesion(dia); }
    if (!s) return;
    const act = s.sets[idEj] ?? 0;
    if (act < totalSeries) {
      s.sets[idEj] = act + 1;
      this.guardar(dia, s);
    }
  }

  deshacerSerie(dia: string, idEj: string): void {
    const s = this.sesion(dia);
    if (!s) return;
    const act = s.sets[idEj] ?? 0;
    if (act > 0) {
      s.sets[idEj] = act - 1;
      this.guardar(dia, s);
    }
  }

  progreso(dia: Dia): { hechas: number; total: number } {
    const s = this.sesion(dia.id);
    let hechas = 0;
    let total = 0;
    for (const e of dia.ejercicios) {
      total += e.series;
      hechas += Math.min(e.series, s?.sets?.[e.id] ?? 0);
    }
    return { hechas, total };
  }

  hoy(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  idDiaHoy(): string {
    return ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'][new Date().getDay()];
  }

  // ---------- Cronómetro ----------
  fmt(seg: number): string {
    const s = Math.max(0, Math.floor(seg));
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  // ---------- Alarma (sonido + vibración), funciona sin red ----------
  desbloquearAudio(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      this.ctx?.resume?.();
    } catch {}
  }

  alarma(): void {
    try {
      if (!this.ctx) this.desbloquearAudio();
      const ctx = this.ctx;
      if (ctx) {
        const t0 = ctx.currentTime + 0.05;
        for (let i = 0; i < 3; i++) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, t0 + i * 0.5);
          osc.frequency.setValueAtTime(1244, t0 + i * 0.5 + 0.2);
          g.gain.setValueAtTime(0.0001, t0 + i * 0.5);
          g.gain.exponentialRampToValueAtTime(0.4, t0 + i * 0.5 + 0.04);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.5 + 0.46);
          osc.connect(g).connect(ctx.destination);
          osc.start(t0 + i * 0.5);
          osc.stop(t0 + i * 0.5 + 0.48);
        }
      }
    } catch {}
    try { navigator.vibrate?.([600, 200, 600, 200, 600]); } catch {}
  }

  vibrar(): void {
    try { navigator.vibrate?.(40); } catch {}
  }

  // ---------- Mantener pantalla encendida durante la rutina ----------
  async mantenerPantalla(): Promise<void> {
    try { this.wake = await (navigator as any).wakeLock?.request('screen'); } catch {}
  }

  soltarPantalla(): void {
    try { this.wake?.release?.(); } catch {}
    this.wake = null;
  }
}
