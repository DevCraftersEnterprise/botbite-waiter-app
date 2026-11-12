import { toSafePdfUrl } from './menu-pdf-url.util';

describe('toSafePdfUrl', () => {
  const cloudinary = 'https://res.cloudinary.com/botbite/image/upload/v1/menus/carta.pdf';

  it('accepts a Cloudinary PDF over https', () => {
    expect(toSafePdfUrl(cloudinary)).toBe(cloudinary);
    expect(toSafePdfUrl(encodeURIComponent(cloudinary))).toBe(cloudinary);
  });

  it('rejects anything that could run code (#39)', () => {
    expect(toSafePdfUrl("javascript:alert(localStorage.getItem('botbite.refresh'))")).toBeNull();
    expect(toSafePdfUrl(' JavaScript:alert(1)')).toBeNull();
    expect(toSafePdfUrl('javascript%3Aalert(1)')).toBeNull();
    expect(toSafePdfUrl('data:application/pdf;base64,JVBERi0=')).toBeNull();
    expect(toSafePdfUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  it('rejects http and other domains', () => {
    expect(toSafePdfUrl(cloudinary.replace('https:', 'http:'))).toBeNull();
    expect(toSafePdfUrl('https://evil.example/a.pdf')).toBeNull();
    expect(toSafePdfUrl('https://res.cloudinary.com.evil.example/a.pdf')).toBeNull();
    expect(toSafePdfUrl('https://evil@res.cloudinary.com/a.pdf')).toBeNull();
  });

  it('rejects empty or malformed values', () => {
    expect(toSafePdfUrl(null)).toBeNull();
    expect(toSafePdfUrl('')).toBeNull();
    expect(toSafePdfUrl('no es una url')).toBeNull();
    expect(toSafePdfUrl('%E0%A4%A')).toBeNull();
  });
});
