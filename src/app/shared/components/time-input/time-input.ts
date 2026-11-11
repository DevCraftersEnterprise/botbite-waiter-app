import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { isTime, normalizeTime } from '../../utils/time.util';

/**
 * Campo de hora siempre en 24 horas ("19:30"). El `input type="time"` del
 * navegador sale con a.m. y p.m. en un Chrome en español, y confunde.
 * Emite "HH:mm" cuando la hora se entiende, "" si queda vacío, o el texto tal
 * cual mientras no se entienda, para que el formulario no deje guardar.
 * Acepta más de 5 caracteres a propósito: si alguien escribe "7:00 pm", debe
 * ver el error y no quedarse con un 07:00 recortado.
 */
@Component({
  selector: 'app-time-input',
  template: `
    <input
      class="input tabular-nums"
      [class]="showInvalid() ? 'border-red-500 bg-red-50/40' : ''"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      maxlength="8"
      placeholder="HH:MM"
      [id]="inputId()"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-invalid]="showInvalid()"
      title="Formato de 24 horas, por ejemplo 19:30"
      [value]="text()"
      (focus)="focused.set(true)"
      (input)="onInput($event)"
      (blur)="onBlur()"
    />
  `,
  // Cabe "00:00" con holgura, sin estirarse como los demás campos.
  host: { class: 'block w-24' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeInputComponent {
  readonly inputId = input<string | null>(null);
  readonly value = input<string>('');
  readonly ariaLabel = input<string | null>(null);
  /** La marca el formulario, por ejemplo con un error de la API. */
  readonly invalid = input(false);
  readonly valueChange = output<string>();

  protected readonly text = signal('');
  protected readonly focused = signal(false);

  /** Mientras se escribe no se marca; al salir del campo, sí. */
  protected readonly showInvalid = computed(() => {
    if (this.invalid()) return true;
    const text = this.text().trim();
    return !this.focused() && !!text && !isTime(normalizeTime(text));
  });

  constructor() {
    // Lo que llega de afuera se muestra, salvo mientras se está escribiendo.
    effect(() => {
      const value = this.value();
      if (!this.focused()) this.text.set(value);
    });
  }

  protected onInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.text.set(raw);
    const time = normalizeTime(raw);
    this.valueChange.emit(isTime(time) || time === '' ? time : raw.trim());
  }

  protected onBlur(): void {
    this.focused.set(false);
    const time = normalizeTime(this.text());
    this.text.set(time);
    if (time !== this.value()) this.valueChange.emit(time);
  }
}
