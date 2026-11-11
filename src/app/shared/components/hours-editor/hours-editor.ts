import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DAYS, emptyHours, HoursForm, toggleDay } from '../../utils/hours.util';
import { TimeInputComponent } from '../time-input/time-input';

/**
 * Horario por días, con varias ventanas que pueden cruzar la medianoche. Lo
 * usan el mesero y los pedidos. Lo que va debajo (la ayuda y los errores) se
 * pasa como contenido.
 */
@Component({
  selector: 'app-hours-editor',
  imports: [TimeInputComponent],
  template: `
    <section class="space-y-3">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-semibold">{{ title() }}</h3>
        <button type="button" class="btn-small" (click)="add()">Agregar horario</button>
      </div>
      @for (window of hours(); track $index; let i = $index) {
        <div class="flex flex-wrap items-end gap-3 rounded-xl border border-black/10 p-3">
          <div class="space-y-1">
            <span class="text-sm font-medium">Días</span>
            <div class="flex gap-1" role="group" [attr.aria-label]="groupLabel() + ' ' + (i + 1)">
              @for (day of days; track day.value) {
                <button
                  type="button"
                  class="h-8 min-w-8 rounded-lg border px-1 text-xs"
                  [class]="
                    window.days.includes(day.value)
                      ? 'border-black bg-black text-white'
                      : 'border-black/20 bg-white'
                  "
                  [attr.aria-pressed]="window.days.includes(day.value)"
                  [attr.aria-label]="day.name"
                  (click)="toggle(i, day.value)"
                >
                  {{ day.label }}
                </button>
              }
            </div>
          </div>
          <div class="space-y-1">
            <label [for]="idPrefix() + 'Opens' + i" class="text-sm font-medium">Abre</label>
            <app-time-input
              [inputId]="idPrefix() + 'Opens' + i"
              [value]="window.opens"
              (valueChange)="patch(i, { opens: $event })"
            />
          </div>
          <div class="space-y-1">
            <label [for]="idPrefix() + 'Closes' + i" class="text-sm font-medium">Cierra</label>
            <app-time-input
              [inputId]="idPrefix() + 'Closes' + i"
              [value]="window.closes"
              (valueChange)="patch(i, { closes: $event })"
            />
          </div>
          <button type="button" class="btn-small-danger ml-auto" (click)="remove(i)">Quitar</button>
        </div>
      } @empty {
        <p class="text-sm" [class]="emptyClass()">{{ emptyText() }}</p>
      }
      <ng-content />
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HoursEditorComponent {
  readonly title = input.required<string>();
  readonly hours = input.required<HoursForm[]>();
  /** Prefijo de los ids de los campos: `<prefijo>Opens0`, `<prefijo>Closes0`… */
  readonly idPrefix = input('hours');
  /** Nombre del grupo de días, para lectores de pantalla y pruebas. */
  readonly groupLabel = input('Días del horario');
  readonly emptyText = input.required<string>();
  readonly emptyClass = input('text-neutral-500');
  readonly hoursChange = output<HoursForm[]>();

  protected readonly days = DAYS;

  protected add(): void {
    this.hoursChange.emit([...this.hours(), emptyHours()]);
  }

  protected remove(index: number): void {
    this.hoursChange.emit(this.hours().filter((_, i) => i !== index));
  }

  protected patch(index: number, changes: Partial<HoursForm>): void {
    this.hoursChange.emit(
      this.hours().map((window, i) => (i === index ? { ...window, ...changes } : window))
    );
  }

  protected toggle(index: number, day: number): void {
    const window = this.hours()[index];
    if (window) this.patch(index, { days: toggleDay(window.days, day) });
  }
}
