import { hoursProblems } from './hours.util';
import { isTime, normalizeTime } from './time.util';
import { TIMEZONES, timezoneLabel, timezoneOptions } from './timezones.util';

describe('normalizeTime', () => {
  it('understands how an hour is typed by hand', () => {
    expect(normalizeTime('1930')).toBe('19:30');
    expect(normalizeTime('19.30')).toBe('19:30');
    expect(normalizeTime('19 30')).toBe('19:30');
    expect(normalizeTime('930')).toBe('09:30');
    expect(normalizeTime('7')).toBe('07:00');
    expect(normalizeTime(' 00:05 ')).toBe('00:05');
    expect(normalizeTime('')).toBe('');
  });

  it('leaves what it does not understand, so the form can mark it', () => {
    expect(normalizeTime('24:00')).toBe('24:00');
    expect(normalizeTime('19:75')).toBe('19:75');
    expect(normalizeTime('7:30 pm')).toBe('7:30 pm');
    expect(isTime(normalizeTime('7:30 pm'))).toBeFalse();
  });
});

describe('hoursProblems', () => {
  const label = (index: number) => `El horario ${index + 1}`;

  it('accepts windows that cross midnight', () => {
    expect(hoursProblems([{ days: [1], opens: '18:00', closes: '01:00' }], label)).toEqual([]);
  });

  it('explains each problem in Spanish', () => {
    expect(
      hoursProblems(
        [
          { days: [], opens: '18:00', closes: '23:00' },
          { days: [1], opens: '', closes: '23:00' },
          { days: [1], opens: '7 pm', closes: '23:00' },
          { days: [1], opens: '18:00', closes: '18:00' },
        ],
        label
      )
    ).toEqual([
      'El horario 1 necesita al menos un día.',
      'El horario 2 necesita hora de apertura y de cierre.',
      'El horario 3 necesita las horas en formato de 24 horas, como 19:30.',
      'El horario 4 necesita apertura y cierre distintos.',
    ]);
  });
});

describe('timezones', () => {
  it('lists the zones of Mexico with a readable name', () => {
    expect(TIMEZONES.map((zone) => zone.value)).toContain('America/Hermosillo');
    expect(timezoneLabel('America/Mexico_City')).toBe('Ciudad de México (centro del país)');
  });

  it('keeps a saved zone that is not in the list', () => {
    expect(timezoneOptions('Europe/Madrid')[0]).toEqual({
      value: 'Europe/Madrid',
      label: 'Europe/Madrid',
    });
    expect(timezoneOptions('America/Cancun')).toBe(TIMEZONES);
  });
});
