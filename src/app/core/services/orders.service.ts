import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OrgService } from './org.service';
import { CashierNotification } from './socket.service';
import {
  BillingDay,
  BranchCatalog,
  CatalogItem,
  DeliveryOrder,
  FulfillmentStatus,
  OrderAccount,
  OrdersSummary,
  RoundItemInput,
  RoundStatus,
} from './types/orders.type';

@Injectable({
  providedIn: 'root',
})
export class OrdersService {
  private http = inject(HttpClient);
  private orgService = inject(OrgService);
  apiUrl = environment.apiBaseUrl;

  activeOrders(branchId: string): Observable<OrderAccount[]> {
    const params = new HttpParams().set('branchId', branchId);

    return this.http
      .get<{ orders: OrderAccount[] }>(`${this.apiUrl}/orders/active`, { params })
      .pipe(map((response) => response.orders));
  }

  /** Pedidos de recoger y domicilio pagados que faltan por entregar. */
  toDeliver(branchId: string): Observable<DeliveryOrder[]> {
    const params = new HttpParams().set('branchId', branchId);

    return this.http
      .get<{ orders: DeliveryOrder[] }>(`${this.apiUrl}/orders/to-deliver`, { params })
      .pipe(map((response) => response.orders));
  }

  updateFulfillment(orderId: string, status: FulfillmentStatus): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/orders/${orderId}/fulfillment`, { status });
  }

  summary(branchId: string): Observable<OrdersSummary> {
    const params = new HttpParams().set('branchId', branchId);

    return this.http.get<OrdersSummary>(`${this.apiUrl}/orders/summary`, { params });
  }

  /** Pagos en línea y facturas de un día de la sucursal. Sin fecha, los de hoy. */
  billing(branchId: string, date?: string): Observable<BillingDay> {
    let params = new HttpParams().set('branchId', branchId);
    if (date) params = params.set('date', date);

    return this.http.get<BillingDay>(`${this.apiUrl}/orders/billing`, { params });
  }

  /** Platillos y mesas aceptadas de la sucursal. Sin lista, se acepta cualquier mesa. */
  catalog(branchId: string): Observable<BranchCatalog> {
    const restaurantId = this.orgService.selectedRestaurantId();

    return this.http
      .get<{
        catalog: CatalogItem[];
        validTables?: string[];
      }>(`${this.apiUrl}/branches/${restaurantId}/${branchId}/catalog`)
      .pipe(
        map((response) => ({
          catalog: response.catalog,
          validTables: response.validTables ?? [],
        })),
      );
  }

  openTab(tab: {
    branchId: string;
    table: string;
    customerName?: string;
    items: RoundItemInput[];
  }): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/orders/tabs`, tab);
  }

  addRound(orderId: string, items: RoundItemInput[]): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/orders/${orderId}/rounds`, { items });
  }

  updateRoundStatus(roundId: string, status: RoundStatus): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/orders/rounds/${roundId}`, { status });
  }

  settle(orderId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/orders/${orderId}/settle`, {});
  }

  cancel(orderId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/orders/${orderId}/cancel`, {});
  }

  getNotificationsByBranch(branchId: string): Observable<{
    active: CashierNotification[];
    inactive: CashierNotification[];
  }> {
    return this.http.get<{
      active: CashierNotification[];
      inactive: CashierNotification[];
    }>(`${this.apiUrl}/notifications?branchId=${branchId}`);
  }

  markNotificationAsRead(notificationId: string): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/notifications/${notificationId}/read`, {});
  }

  markNotificationAsUnread(notificationId: string): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/notifications/${notificationId}/unread`, {});
  }
}
