import { formErrorSummary, toFormErrors } from './api-errors.util';

const apiError = (message: string | string[]) => ({ error: { message, statusCode: 400 } });

describe('toFormErrors', () => {
  const fields = ['latitude', 'longitude', 'slug', 'whatsappPhoneNumberId', 'phoneNumberAssistant'];

  it('puts class-validator messages next to their field, in Spanish', () => {
    const errors = toFormErrors(
      apiError([
        'latitude must not be greater than 90',
        'longitude must be a number conforming to the specified constraints',
        'slug must be lowercase words separated by hyphens',
      ]),
      fields
    );

    expect(errors.fields).toEqual({
      latitude: 'Debe ser como máximo 90.',
      longitude: 'Debe ser un número.',
      slug: 'Solo minúsculas, números y guiones.',
    });
    expect(errors.general).toEqual([]);
  });

  it('understands the messages of the API itself', () => {
    const errors = toFormErrors(apiError('The slug must start with sushilito-s-'), fields);
    expect(errors.fields).toEqual({ slug: 'Debe empezar con sushilito-s-' });

    expect(
      toFormErrors(apiError('whatsappPhoneNumberId is already used by another branch'), fields)
        .fields
    ).toEqual({ whatsappPhoneNumberId: 'Ese phone number ID ya lo usa otra sucursal.' });

    expect(
      toFormErrors(
        apiError(['phoneNumberAssistant must be in E.164 format (e.g. +5215512345678)']),
        fields
      ).fields['phoneNumberAssistant']
    ).toContain('+5216441234567');
  });

  it('keeps what is not a field of the form as a general message', () => {
    const errors = toFormErrors(
      apiError(['features.wallet must be a boolean value', 'Only administrators can change: slug']),
      fields
    );

    expect(errors.fields).toEqual({});
    expect(errors.general).toEqual([
      'Debe ser sí o no.',
      'Solo un administrador de BotBite puede cambiar eso.',
    ]);
    expect(formErrorSummary(errors)).toContain('Solo un administrador');
  });

  it('falls back to a generic message when the API sends nothing useful', () => {
    const errors = toFormErrors({ status: 0, error: null }, fields);
    expect(errors.general).toEqual(['No se pudo guardar. Intenta de nuevo.']);
    expect(formErrorSummary({ fields: { slug: 'x' }, general: [] })).toContain('marcados en rojo');
  });
});
