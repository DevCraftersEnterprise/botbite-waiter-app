import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { map, Observable } from 'rxjs';
import { Order, OrderListResponse } from './types/orders.type';
import { ConversationsListResponse } from './types/conversations.types';
import { CashierNotification } from './socket.service';

@Injectable({
  providedIn: 'root',
})
export class OrdersService {
  private http = inject(HttpClient);
  apiUrl = environment.apiBaseUrl;

  getAll(opts: { branchId: string; date: string }): Observable<Order[]> {
    const params = new HttpParams().set('branchId', opts.branchId).set('date', opts.date);

    return this.http
      .get<OrderListResponse>(`${this.apiUrl}/orders`, { params })
      .pipe(map((res: OrderListResponse) => res.orders));
  }

  activeOrders(branchId: string): Observable<ConversationsListResponse> {
    const params = new HttpParams().set('branchId', branchId);

    return this.http.get<ConversationsListResponse>(`${this.apiUrl}/messages/conversations`, {
      params,
    });
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
