import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CustomerListResponse, CustomerQuery } from './types/customers.types';

/** Pantalla Clientes: solo el dueño y los administradores de BotBite. */
@Injectable({
  providedIn: 'root',
})
export class CustomersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiBaseUrl;

  list(restaurantId: string, query: CustomerQuery): Observable<CustomerListResponse> {
    return this.http.get<CustomerListResponse>(this.url(restaurantId), {
      params: this.params(query),
    });
  }

  /** El teléfono completo. La API registra quién lo vio. */
  revealPhone(restaurantId: string, customerId: string): Observable<{ phone: string }> {
    return this.http.post<{ phone: string }>(`${this.url(restaurantId)}/${customerId}/phone`, {});
  }

  /** CSV con los mismos filtros, sin paginar. La API registra la exportación. */
  export(restaurantId: string, query: CustomerQuery): Observable<Blob> {
    const { search, status, promos, sort, order } = query;
    return this.http.get(`${this.url(restaurantId)}/export`, {
      params: this.params({ search, status, promos, sort, order }),
      responseType: 'blob',
    });
  }

  private url(restaurantId: string): string {
    return `${this.apiUrl}/restaurants/${restaurantId}/customers`;
  }

  private params(query: CustomerQuery): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return params;
  }
}
