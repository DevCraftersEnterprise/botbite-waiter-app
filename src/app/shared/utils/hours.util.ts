import { isTime } from './time.util';

/** Lunes primero, como se lee un horario; la API usa 0 = domingo. */
export const DAYS: { value: number; label: string; name: string }[] = [
  { value: 1, label: 'L', name: 'lunes' },
  { value: 2, label: 'M', name: 'martes' },
  { value: 3, label: 'Mi', name: 'miércoles' },
  { value: 4, label: 'J', name: 'jueves' },
  { value: 5, label: 'V', name: 'viernes' },
  { value: 6, label: 'S', name: 'sábado' },
  { value: 0, label: 'D', name: 'domingo' },
];

/** Una ventana de horario: el mesero y los pedidos usan la misma forma. */
export interface HoursForm {
  days: number[];
  opens: string;
  /** Si es menor que `opens`, cierra al día siguiente. */
  closes: string;
}

export const emptyHours = (): HoursForm => ({
  days: [0, 1, 2, 3, 4, 5, 6],
  opens: '',
  closes: '',
});

/** Agrega o quita un día de una lista, sin repetirlo. */
export const toggleDay = (days: number[], day: number): number[] =>
  days.includes(day) ? days.filter((value) => value !== day) : [...days, day];

/** Lo que impide guardar un horario, en español. `label` nombra cada ventana. */
export const hoursProblems = (hours: HoursForm[], label: (index: number) => string): string[] =>
  hours.flatMap((window, index) => {
    const name = label(index);
    const problems: string[] = [];

    if (!window.days.length) problems.push(`${name} necesita al menos un día.`);
    if (!window.opens || !window.closes) {
      problems.push(`${name} necesita hora de apertura y de cierre.`);
    } else if (!isTime(window.opens) || !isTime(window.closes)) {
      problems.push(`${name} necesita las horas en formato de 24 horas, como 19:30.`);
    } else if (window.opens === window.closes) {
      problems.push(`${name} necesita apertura y cierre distintos.`);
    }

    return problems;
  });
