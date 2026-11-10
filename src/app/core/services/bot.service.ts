import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OrgService } from './org.service';
import { BotConfig, BotKey, CreatedBotKey, UpdateBotConfig } from './types/bot.types';
import { Ordering, UpdateOrdering } from './types/ordering.types';

@Injectable({
  providedIn: 'root',
})
export class BotService {
  private readonly http = inject(HttpClient);
  private readonly orgService = inject(OrgService);
  private readonly apiUrl = environment.apiBaseUrl;

  getConfig(branchId: string): Observable<BotConfig> {
    return this.http
      .get<{ config: BotConfig }>(`${this.branchUrl(branchId)}/bot-config`)
      .pipe(map((response) => response.config));
  }

  updateConfig(branchId: string, changes: UpdateBotConfig): Observable<BotConfig> {
    return this.http
      .patch<{ config: BotConfig }>(`${this.branchUrl(branchId)}/bot-config`, changes)
      .pipe(map((response) => response.config));
  }

  /** null: la sucursal nunca configuró pedidos. */
  getOrdering(branchId: string): Observable<Ordering | null> {
    return this.http
      .get<{ ordering: Ordering | null }>(`${this.branchUrl(branchId)}/ordering`)
      .pipe(map((response) => response.ordering));
  }

  updateOrdering(branchId: string, changes: UpdateOrdering): Observable<Ordering> {
    return this.http
      .patch<{ ordering: Ordering }>(`${this.branchUrl(branchId)}/ordering`, changes)
      .pipe(map((response) => response.ordering));
  }

  /** "Recibiendo pedidos": también lo usa caja. */
  setAccepting(branchId: string, accepting: boolean): Observable<{ accepting: boolean }> {
    return this.http.patch<{ accepting: boolean }>(
      `${this.branchUrl(branchId)}/ordering/accepting`,
      { accepting }
    );
  }

  listKeys(branchId: string): Observable<BotKey[]> {
    return this.http
      .get<{ keys: BotKey[] }>(`${this.branchUrl(branchId)}/bot-keys`)
      .pipe(map((response) => response.keys));
  }

  createKey(branchId: string, name: string): Observable<CreatedBotKey> {
    return this.http.post<CreatedBotKey>(`${this.branchUrl(branchId)}/bot-keys`, { name });
  }

  revokeKey(branchId: string, keyId: string): Observable<void> {
    return this.http.delete<void>(`${this.branchUrl(branchId)}/bot-keys/${keyId}`);
  }

  private branchUrl(branchId: string): string {
    const restaurantId = this.orgService.selectedRestaurantId();

    if (!restaurantId) {
      throw new Error('No restaurant selected');
    }

    return `${this.apiUrl}/branches/${restaurantId}/${branchId}`;
  }
}
