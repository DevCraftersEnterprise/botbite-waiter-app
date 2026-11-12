import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { OrgService } from './org.service';

describe('OrgService', () => {
  const api = environment.apiBaseUrl;
  let org: OrgService;
  let backend: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    org = TestBed.inject(OrgService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => localStorage.clear());

  it('forgets the restaurants and the selection of the previous user on logout (#40)', () => {
    org.restaurants.set([{ id: 'r-a', name: 'A' } as never]);
    org.selectRestaurant('r-a');
    org.selectBranch('b-a');

    TestBed.inject(AuthService).logout();

    expect(org.restaurants()).toEqual([]);
    expect(org.branches()).toEqual([]);
    expect(org.selectedRestaurantId()).toBeNull();
    expect(org.selectedBranchId()).toBeNull();
  });

  it('does not restore the saved selection before knowing who logged in (#40)', () => {
    localStorage.setItem('botbite.restaurantId', 'r-a');
    localStorage.setItem('botbite.branchId::r-a', 'b-a');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });

    const fresh = TestBed.inject(OrgService);

    expect(fresh.selectedRestaurantId()).toBeNull();
    expect(fresh.selectedBranchId()).toBeNull();
  });

  it('restores the saved restaurant when the user has it', () => {
    localStorage.setItem('botbite.restaurantId', 'r-b');

    org.loadRestaurants().subscribe();
    backend
      .expectOne(`${api}/restaurants`)
      .flush({ restaurants: [{ id: 'r-a' }, { id: 'r-b' }], total: 2, pagination: {} });

    expect(org.selectedRestaurantId()).toBe('r-b');
  });

  it('only reuses the saved restaurant if the new user has it', () => {
    org.selectRestaurant('r-a');
    TestBed.inject(AuthService).logout();

    org.loadRestaurants().subscribe();
    backend
      .expectOne(`${api}/restaurants`)
      .flush({ restaurants: [{ id: 'r-b', name: 'B' }], total: 1, pagination: {} });

    expect(org.selectedRestaurantId()).toBe('r-b');
  });
});
