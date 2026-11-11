import { DOCUMENT } from '@angular/common';
import { inject, Injectable, InjectionToken, signal } from '@angular/core';

/** Se recuerda en este navegador: cada equipo de caja decide si suena. */
const MUTED_KEY = 'botbite.sound-muted';

/** Crea el AudioContext. Las pruebas lo cambian por uno falso. */
export const AUDIO_CONTEXT_FACTORY = new InjectionToken<() => AudioContext | null>(
  'AUDIO_CONTEXT_FACTORY',
  {
    providedIn: 'root',
    factory: () => () => (typeof AudioContext === 'undefined' ? null : new AudioContext()),
  }
);

export type AlertSound = 'notification' | 'order';

interface Tone {
  frequency: number;
  /** Segundos desde que empieza el sonido. */
  start: number;
  duration: number;
}

/**
 * - `notification`: un tono corto, como el que ya tenía Notificaciones.
 * - `order`: un pedido pagado; más largo, para distinguirlo (decisión 7).
 */
const SOUNDS: Record<AlertSound, Tone[]> = {
  notification: [{ frequency: 880, start: 0, duration: 0.2 }],
  order: [0, 0.75].flatMap((offset) => [
    { frequency: 660, start: offset, duration: 0.16 },
    { frequency: 880, start: offset + 0.2, duration: 0.16 },
    { frequency: 1175, start: offset + 0.4, duration: 0.3 },
  ]),
};

const VOLUME = 0.08;

const readMuted = (): boolean => {
  try {
    return localStorage.getItem(MUTED_KEY) === 'true';
  } catch {
    return false;
  }
};

/**
 * Los sonidos del panel (decisiones 7 y 8). El navegador no deja sonar nada
 * hasta que la persona hace clic o teclea en la página, por ejemplo después de
 * recargar: mientras tanto, `blocked` queda en true y la barra de arriba
 * muestra "Activar sonido".
 */
@Injectable({ providedIn: 'root' })
export class AlertSoundService {
  private readonly document = inject(DOCUMENT);
  private readonly createContext = inject(AUDIO_CONTEXT_FACTORY);

  /** El navegador todavía no deja sonar. */
  readonly blocked = signal(false);
  /** Silenciado en este equipo. */
  readonly muted = signal(readMuted());

  private context: AudioContext | null = null;
  private listening = false;

  /** Prepara el audio y desbloquea con el primer clic o tecla en la página. */
  start(): void {
    const context = this.audio();
    if (!context) return;
    this.blocked.set(context.state !== 'running');

    if (this.listening) return;
    this.listening = true;
    this.document.addEventListener('pointerdown', this.unlockOnGesture, true);
    this.document.addEventListener('keydown', this.unlockOnGesture, true);
  }

  stop(): void {
    this.document.removeEventListener('pointerdown', this.unlockOnGesture, true);
    this.document.removeEventListener('keydown', this.unlockOnGesture, true);
    this.listening = false;
  }

  /** Lo llama el botón "Activar sonido" (y cualquier clic en la página). */
  async unlock(): Promise<void> {
    const context = this.audio();
    if (!context) return;
    try {
      if (context.state !== 'running') await context.resume();
    } catch {
      // Sigue bloqueado: el botón sigue a la vista.
    }
    this.blocked.set(context.state !== 'running');
  }

  toggleMuted(): void {
    const muted = !this.muted();
    this.muted.set(muted);
    try {
      localStorage.setItem(MUTED_KEY, String(muted));
    } catch {
      // Sin almacenamiento, el cambio dura hasta recargar.
    }
    if (!muted) void this.unlock();
  }

  /** @returns true si sonó. */
  play(sound: AlertSound): boolean {
    if (this.muted()) return false;

    const context = this.audio();
    if (!context) return false;
    if (context.state !== 'running') {
      this.blocked.set(true);
      return false;
    }

    // Todos los tonos se crean juntos y se programan con el reloj del audio.
    const now = context.currentTime;
    for (const tone of SOUNDS[sound]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = now + tone.start;
      const end = start + tone.duration;

      oscillator.frequency.value = tone.frequency;
      // Entra y sale suave para que no truene.
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(VOLUME, start + 0.02);
      gain.gain.linearRampToValueAtTime(0, end);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(end);
    }
    return true;
  }

  private audio(): AudioContext | null {
    if (!this.context) {
      try {
        this.context = this.createContext();
      } catch {
        this.context = null;
      }
      this.context?.addEventListener('statechange', () =>
        this.blocked.set(this.context?.state !== 'running')
      );
    }
    return this.context;
  }

  private readonly unlockOnGesture = () => {
    if (this.blocked()) void this.unlock();
  };
}
