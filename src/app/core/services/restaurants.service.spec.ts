import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { RestaurantsService } from './restaurants.service';

describe('RestaurantsService', () => {
  const api = environment.apiBaseUrl;
  let service: RestaurantsService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(RestaurantsService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('uploads the logo as a file', () => {
    const file = new File(['png'], 'logo.png', { type: 'image/png' });
    service.uploadLogo('r1', file).subscribe();

    const req = backend.expectOne(`${api}/restaurants/r1/logo`);
    expect(req.request.method).toBe('PATCH');
    expect((req.request.body as FormData).get('file')).toBe(file);
    req.flush({ restaurant: { id: 'r1', logoUrl: 'https://res.cloudinary.com/x/logo.png' } });
  });

  it('removes the logo', () => {
    service.removeLogo('r1').subscribe();

    const req = backend.expectOne(`${api}/restaurants/r1/logo`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ restaurant: { id: 'r1', logoUrl: null } });
  });

  it('sends the privacy notice with the restaurant changes', () => {
    service.update('r1', { privacyUrl: 'https://tacos.mx/privacidad' }).subscribe();

    const req = backend.expectOne(`${api}/restaurants/r1`);
    expect(req.request.body).toEqual({ privacyUrl: 'https://tacos.mx/privacidad' });
    req.flush({ restaurant: { id: 'r1' } });
  });
});
