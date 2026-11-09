import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/services/auth.service';
import { OrgService } from '../../../../core/services/org.service';
import { Branch } from '../../../../core/services/types/branches.types';
import { BotConfig } from '../../../../core/services/types/bot.types';
import { BotConfigModalComponent, joinSlug, splitSlug } from './bot-config-modal.component';

describe('slug with a fixed restaurant prefix', () => {
  it('only edits what follows the prefix', () => {
    expect(splitSlug('sushilito-s-morelos', 'sushilito-s')).toBe('morelos');
    expect(joinSlug('morelos', 'sushilito-s')).toBe('sushilito-s-morelos');
    expect(joinSlug(' -centro ', 'tacos-a')).toBe('tacos-a-centro');
  });

  it('keeps slugs from before the standard as they are', () => {
    expect(splitSlug('centro', 'tacos-a')).toBe('centro');
    expect(splitSlug('centro', null)).toBe('centro');
  });
});

describe('BotConfigModalComponent', () => {
  const url = `${environment.apiBaseUrl}/branches/r1/b1`;
  let fixture: ComponentFixture<BotConfigModalComponent>;
  let backend: HttpTestingController;
  let toastr: jasmine.SpyObj<ToastrService>;
  let component: BotConfigModalComponent & Record<string, any>;

  const branch = {
    id: 'b1',
    name: 'Morelos',
    restaurant: { slug: 'sushilito-s' },
  } as Branch;

  const config: BotConfig = {
    id: 'b1',
    slug: 'sushilito-s-morelos',
    name: 'Morelos',
    whatsappPhoneNumberId: null,
    botBaseUrl: null,
    latitude: 27.535038,
    longitude: -109.954031,
    verifyLocation: true,
    geofenceMeters: 200,
    qrCodeMinutes: 10,
    validTables: [],
    sessionHours: 4,
    postSaleHours: 2,
    maxRecommendations: 3,
    timezone: 'America/Hermosillo',
    dailyCloseTime: '23:00',
    surveyUrl: null,
    features: {
      interactiveMenu: true,
      pdfMenu: true,
      recommendations: true,
      wallet: false,
      mercadoPago: false,
      invoicing: false,
      promotions: false,
      survey: false,
    },
  };

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(async () => {
    toastr = jasmine.createSpyObj<ToastrService>('ToastrService', ['success', 'error']);

    await TestBed.configureTestingModule({
      imports: [BotConfigModalComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: ToastrService, useValue: toastr },
        { provide: OrgService, useValue: { selectedRestaurantId: () => 'r1' } },
      ],
    }).compileComponents();

    TestBed.inject(AuthService).user.set({
      id: 'u1',
      email: 'admin@botbite.test',
      roles: ['admin'],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BotConfigModalComponent);
    component = fixture.componentInstance as BotConfigModalComponent & Record<string, any>;
    fixture.componentRef.setInput('branch', branch);
    await fixture.whenStable();

    backend.expectOne(`${url}/bot-config`).flush({ config });
    backend.expectOne(`${url}/bot-keys`).flush({ keys: [] });
    await fixture.whenStable();
  });

  afterEach(() => backend.verify());

  it('shows the coordinates in one field and suggests the base URL of the bot', () => {
    const coordinates = fixture.nativeElement.querySelector('#botCoordinates') as HTMLInputElement;
    expect(coordinates.value).toBe('27.535038, -109.954031');
    expect(text()).toContain('sushilito-s-');
    expect(text()).toContain('https://bot.botbite.com.mx/m/sushilito-s-morelos');
  });

  it('rounds pasted coordinates and does not send an unchanged slug', async () => {
    const input = fixture.nativeElement.querySelector('#botCoordinates') as HTMLInputElement;
    input.value = '27.5350381, -109.9540312';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    component['save']();
    const request = backend.expectOne(`${url}/bot-config`);
    expect(request.request.body.latitude).toBe(27.535038);
    expect(request.request.body.longitude).toBe(-109.954031);
    expect('slug' in request.request.body).toBeFalse();
    request.flush({ config });
  });

  it('puts the error of the server next to its field, in Spanish', async () => {
    component['save']();
    backend
      .expectOne(`${url}/bot-config`)
      .flush(
        {
          message: [
            'latitude must not be greater than 90',
            'timezone must be a valid IANA time-zone',
          ],
        },
        { status: 400, statusText: 'Bad Request' }
      );
    await fixture.whenStable();

    expect(text()).toContain('Debe ser como máximo 90.');
    expect(text()).toContain('No es una zona horaria válida');
    expect(toastr.error).toHaveBeenCalledWith(
      'No se pudo guardar. Revisa los campos marcados en rojo.'
    );
  });

  it('does not close with a new key that was not copied', async () => {
    const closed = jasmine.createSpy('closed');
    component.closed.subscribe(closed);

    component['createdSecret'].set('bb_secret');
    component['close']();
    await fixture.whenStable();

    expect(closed).not.toHaveBeenCalled();
    expect(text()).toContain('No has copiado la llave nueva');

    component['leaveWithoutCopying']();
    expect(closed).toHaveBeenCalled();
  });
});
