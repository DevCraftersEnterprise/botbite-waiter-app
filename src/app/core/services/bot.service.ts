import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OrgService } from './org.service';
import { BotConfig, BotKey, CreatedBotKey, UpdateBotConfig } from './types/bot.types';

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
