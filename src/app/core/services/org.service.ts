import { HttpClient, HttpParams } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { catchError, finalize, of, tap } from 'rxjs';
import { Restaurant, RestaurantListResponse } from './types/restaurants.types';
import { Branch, BranchListResponse } from './types/branches.types';
import { logError } from './error-log';

@Injectable({
  providedIn: 'root',
})
export class OrgService {
  private readonly http = inject(HttpClient);
  private readonly LS_RESTAURANT = 'botbite.restaurantId';
  private readonly LS_BRANCHKEY = (restaurantId: string) => `botbite.branchId::${restaurantId}`;
  private readonly apiUrl = environment.apiBaseUrl;

  readonly restaurants = signal<Restaurant[]>([]);
  readonly selectedRestaurantId = signal<string | null>(null);
  readonly selectedRestaurant = computed(
    () => this.restaurants()?.find((r) => r.id === this.selectedRestaurantId()) ?? null
  );

  readonly branches = signal<Branch[]>([]);
  readonly selectedBranchId = signal<string | null>(null);
  readonly selectedBranch = computed(
    () => this.branches().find((b) => b.id === this.selectedBranchId()) ?? null
  );

  readonly loadingRestaurants = signal<boolean>(false);
  readonly loadingBranches = signal<boolean>(false);

  constructor() {
    // La selección guardada no se restaura al arrancar: puede ser de otro usuario
    // de la misma computadora (issue #40). `loadRestaurants` y la carga de
    // sucursales la usan solo si el usuario que entró tiene ese restaurante.
    inject(AuthService).sessionEnded.subscribe(() => this.reset());

    effect(() => {
      const rid = this.selectedRestaurantId();

      if (!rid) {
        this.branches.set([]);
        this.selectedBranchId.set(null);
        return;
      }

      this.loadAllActiveBranches(rid).subscribe();
    });
  }

  loadRestaurants() {
    this.loadingRestaurants.set(true);

    return this.http.get<RestaurantListResponse>(`${this.apiUrl}/restaurants`).pipe(
      tap((list) => {
        this.restaurants.set(Array.isArray(list.restaurants) ? list.restaurants : []);

        const currentSelection = this.selectedRestaurantId();
        const exists = currentSelection && list.restaurants.some((r) => r.id === currentSelection);

        if (exists) {
          return;
        }

        const saved = localStorage.getItem(this.LS_RESTAURANT);
        const savedExists = saved && list.restaurants.some((r) => r.id === saved);
        const fallback = list.restaurants[0]?.id ?? null;

        const newSelection = savedExists ? saved! : fallback;
        this.selectedRestaurantId.set(newSelection);

        if (newSelection) {
          localStorage.setItem(this.LS_RESTAURANT, newSelection);
        }
      }),
      catchError((error) => {
        logError('Error loading restaurants:', error);
        this.restaurants.set([]);
        this.selectedRestaurantId.set(null);
        return of({ restaurants: [], total: 0, pagination: {} as any });
      }),
      finalize(() => this.loadingRestaurants.set(false))
    );
  }

  /**
   * Al cerrar sesión: los restaurantes, las sucursales y la selección eran del
   * usuario anterior (issue #40). Lo guardado en localStorage se queda: al
   * entrar, `loadRestaurants` lo usa solo si el usuario nuevo tiene ese
   * restaurante.
   */
  reset(): void {
    this.restaurants.set([]);
    this.branches.set([]);
    this.selectedRestaurantId.set(null);
    this.selectedBranchId.set(null);
  }

  selectRestaurant(id: string | null): void {
    this.selectedRestaurantId.set(id);
    if (id) {
      localStorage.setItem(this.LS_RESTAURANT, id);
    } else {
      localStorage.removeItem(this.LS_RESTAURANT);
    }
  }

  private loadAllActiveBranches(restaurantId: string) {
    this.loadingBranches.set(true);

    const params = new HttpParams().set('isActive', 'true').set('limit', '1000').set('offset', '0');

    return this.http
      .get<BranchListResponse>(`${this.apiUrl}/branches/restaurant/${restaurantId}`, { params })
      .pipe(
        tap((list) => {
          this.branches.set(Array.isArray(list.branches) ? list.branches : []);

          const currentSelection = this.selectedBranchId();
          const exists = currentSelection && list.branches.some((b) => b.id === currentSelection);

          if (exists) {
            return;
          }

          const saved = localStorage.getItem(this.LS_BRANCHKEY(restaurantId));
          const savedExists = saved && list.branches.some((b) => b.id === saved);
          const fallback = list.branches[0]?.id ?? null;

          const nextBranchId = savedExists ? saved : fallback;
          this.selectedBranchId.set(nextBranchId);

          if (nextBranchId) {
            localStorage.setItem(this.LS_BRANCHKEY(restaurantId), nextBranchId);
          }
        }),
        catchError((error) => {
          logError('Error loading branches:', error);
          this.branches.set([]);
          this.selectedBranchId.set(null);
          return of({ branches: [], total: 0 });
        }),
        finalize(() => this.loadingBranches.set(false))
      );
  }

  selectBranch(branchId: string | null): void {
    const rid = this.selectedRestaurantId();
    this.selectedBranchId.set(branchId);

    if (rid && branchId) {
      localStorage.setItem(this.LS_BRANCHKEY(rid), branchId);
    } else if (rid && !branchId) {
      localStorage.removeItem(this.LS_BRANCHKEY(rid));
    }
  }

  updateSelectedBranch(patch: Partial<Branch>): void {
    const current = this.selectedBranch();
    if (!current) return;

    const updated = { ...current, ...patch };
    const next = this.branches().map((b) => (b.id === updated.id ? updated : b));

    this.branches.set(next);
  }

  refreshGlobalBranches(): void {
    const rid = this.selectedRestaurantId();
    if (rid) {
      this.loadAllActiveBranches(rid).subscribe();
    }
  }
}
