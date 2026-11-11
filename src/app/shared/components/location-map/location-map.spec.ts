import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import * as L from 'leaflet';
import { LocationMapComponent, MapPoint, NOMINATIM_URL } from './location-map';

describe('LocationMapComponent', () => {
  let fixture: ComponentFixture<LocationMapComponent>;
  let component: LocationMapComponent & Record<string, any>;
  let backend: HttpTestingController;
  let emitted: MapPoint[];

  /** Deja que se cree el mapa (afterNextRender) y corran los efectos. */
  const render = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LocationMapComponent],
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LocationMapComponent);
    component = fixture.componentInstance as LocationMapComponent & Record<string, any>;
    emitted = [];
    component.pointChange.subscribe((point) => emitted.push(point));
  });

  afterEach(() => backend.verify());

  it('marks the point with a click, with 6 decimals', async () => {
    await render();

    (component['map'] as L.Map).fire('click', { latlng: L.latLng(27.4827481, -109.9304052) });

    expect(emitted).toEqual([{ latitude: 27.482748, longitude: -109.930405 }]);
    expect(component['marker']).not.toBeNull();
  });

  it('shows the point and the radius it receives', async () => {
    fixture.componentRef.setInput('latitude', 27.48);
    fixture.componentRef.setInput('longitude', -109.93);
    fixture.componentRef.setInput('radiusMeters', 200);
    await render();

    const circle = component['circle'] as L.Circle;
    expect(circle.getRadius()).toBe(200);
    expect(circle.getLatLng()).toEqual(L.latLng(27.48, -109.93));

    fixture.componentRef.setInput('radiusMeters', 500);
    await render();
    expect((component['circle'] as L.Circle).getRadius()).toBe(500);
  });

  it('moves the map to the address it finds, without marking the point', async () => {
    await render();
    component['query'].set('Calle Sinaloa 50, Ciudad Obregón');
    component['search']();

    const request = backend.expectOne((req) => req.url === NOMINATIM_URL);
    expect(request.request.params.get('countrycodes')).toBe('mx');
    request.flush([{ lat: '27.48', lon: '-109.92', display_name: 'Calle Sinaloa, Ciudad Obregón' }]);
    await render();

    const center = (component['map'] as L.Map).getCenter();
    expect(center.lat).toBeCloseTo(27.48, 3);
    expect(emitted).toEqual([]);
    expect(component['searchMessage']()).toContain('Haz clic para marcar el punto');
  });

  it('says so when it finds nothing', async () => {
    await render();
    component['query'].set('xyz');
    component['search']();

    backend.expectOne((req) => req.url === NOMINATIM_URL).flush([]);

    expect(component['searchMessage']()).toContain('No se encontró esa dirección');
  });
});
