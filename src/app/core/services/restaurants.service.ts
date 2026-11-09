import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { map, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OrgService } from './org.service';
import { Restaurant, RestaurantListResponse, RestaurantResponse } from './types/restaurants.types';

@Injectable({
  providedIn: 'root',
})
export class RestaurantsService {
  private readonly http = inject(HttpClient);
  private readonly org = inject(OrgService);
  private readonly apiUrl = environment.apiBaseUrl;

  readonly restaurants = signal<Restaurant[]>([]);
  readonly totalRestaurants = signal<number>(0);

  list(params: {
    search?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Observable<RestaurantListResponse> {
    let httpParams = new HttpParams();

    if (params?.search) {
      httpParams = httpParams.set('search', params.search);
    }
    if (params?.isActive !== undefined) {
      httpParams = httpParams.set('isActive', params.isActive.toString());
    }
    if (params?.limit !== undefined) {
      httpParams = httpParams.set('limit', params.limit.toString());
    }
    if (params?.offset !== undefined) {
      httpParams = httpParams.set('offset', params.offset.toString());
    }

    return this.http
      .get<RestaurantListResponse>(`${this.apiUrl}/restaurants`, { params: httpParams })
      .pipe(
        tap((response) => {
          this.restaurants.set(response.restaurants);
          this.totalRestaurants.set(response.total);
        })
      );
  }

  create(newRestaurant: Partial<Restaurant>): Observable<RestaurantResponse> {
    return this.http.post<RestaurantResponse>(`${this.apiUrl}/restaurants`, newRestaurant);
  }

  update(id: string, updatedRestaurant: Partial<Restaurant>): Observable<RestaurantResponse> {
    return this.http.patch<RestaurantResponse>(`${this.apiUrl}/restaurants/${id}`, updatedRestaurant);
  }

  /** Sube el logo; la API lo deja cuadrado y avisa al bot. */
  uploadLogo(id: string, file: File): Observable<RestaurantResponse> {
    const form = new FormData();
    form.append('file', file);
    return this.http.patch<RestaurantResponse>(`${this.apiUrl}/restaurants/${id}/logo`, form);
  }

  removeLogo(id: string): Observable<RestaurantResponse> {
    return this.http.delete<RestaurantResponse>(`${this.apiUrl}/restaurants/${id}/logo`);
  }

  remove(id: string): Observable<RestaurantResponse> {
    return this.http.delete<RestaurantResponse>(`${this.apiUrl}/restaurants/${id}`);
  }
}
