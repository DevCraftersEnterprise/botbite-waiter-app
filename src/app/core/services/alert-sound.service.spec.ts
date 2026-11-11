import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AlertSoundService, AUDIO_CONTEXT_FACTORY } from './alert-sound.service';

/** Lo mínimo de un AudioContext: cuenta los tonos que se crean. */
class FakeAudioContext {
  state: AudioContextState = 'suspended';
  currentTime = 0;
  destination = {};
  oscillators = 0;
  private readonly listeners: (() => void)[] = [];

  addEventListener(_event: string, listener: () => void) {
    this.listeners.push(listener);
  }

  async resume() {
    this.state = 'running';
    this.listeners.forEach((listener) => listener());
  }

  createOscillator() {
    this.oscillators += 1;
    return {
      frequency: { value: 0 },
      connect: (node: unknown) => node,
      start: () => undefined,
      stop: () => undefined,
    };
  }

  createGain() {
    return {
      gain: { setValueAtTime: () => undefined, linearRampToValueAtTime: () => undefined },
      connect: (node: unknown) => node,
    };
  }
}

describe('AlertSoundService', () => {
  let audio: FakeAudioContext;
  let sound: AlertSoundService;

  /** Deja correr las promesas pendientes (`resume`). */
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve));

  beforeEach(() => {
    localStorage.removeItem('botbite.sound-muted');
    audio = new FakeAudioContext();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: AUDIO_CONTEXT_FACTORY, useValue: () => audio as unknown as AudioContext },
      ],
    });
    sound = TestBed.inject(AlertSoundService);
  });

  afterEach(() => {
    sound.stop();
    localStorage.removeItem('botbite.sound-muted');
  });

  it('stays blocked until the first click in the page (decision 8)', async () => {
    sound.start();
    expect(sound.blocked()).toBeTrue();
    expect(sound.play('notification')).toBeFalse();

    document.dispatchEvent(new Event('pointerdown'));
    await settle();

    expect(sound.blocked()).toBeFalse();
    expect(sound.play('notification')).toBeTrue();
  });

  it('unlocks with the "Activar sonido" button', async () => {
    sound.start();

    await sound.unlock();

    expect(sound.blocked()).toBeFalse();
  });

  it('plays a longer sound for a paid order than for a notification (decision 7)', async () => {
    sound.start();
    await sound.unlock();

    sound.play('notification');
    const notificationTones = audio.oscillators;
    sound.play('order');

    expect(notificationTones).toBe(1);
    expect(audio.oscillators - notificationTones).toBeGreaterThan(notificationTones);
  });

  it('remembers the mute in this browser and plays nothing while muted', async () => {
    sound.start();
    await sound.unlock();

    sound.toggleMuted();

    expect(sound.muted()).toBeTrue();
    expect(localStorage.getItem('botbite.sound-muted')).toBe('true');
    expect(sound.play('order')).toBeFalse();
    expect(audio.oscillators).toBe(0);

    sound.toggleMuted();
    expect(localStorage.getItem('botbite.sound-muted')).toBe('false');
    expect(sound.play('order')).toBeTrue();
  });
});
