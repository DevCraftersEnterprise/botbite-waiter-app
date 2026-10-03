import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OrgService } from './org.service';
import {
  Branch,
  BranchesBulkResponse,
  BranchListResponse,
  BranchResponse,
  StaffListResponse,
  StaffMember,
} from './types/branches.types';

@Injectable({
  providedIn: 'root',
})
export class BranchesService {
  private readonly http = inject(HttpClient);
  private readonly orgService = inject(OrgService);
  private readonly apiUrl = environment.apiBaseUrl;

  generateQr(branchId: string): Observable<{ qrUrl: string }> {
    const restaurantId = this.orgService.selectedRestaurantId();

    const url = `${this.apiUrl}/branches/generate-qr/${restaurantId}/${branchId}`;
    return this.http.get<{ qrUrl: string }>(url, {});
  }

  listByRestaurant(params: {
    search?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Observable<BranchListResponse> {
    const restaurantId = this.orgService.selectedRestaurantId();

    if (!restaurantId) {
      throw new Error('No restaurant selected');
    }

    let httpParams = new HttpParams();

    if (params.search) {
      httpParams = httpParams.set('search', params.search);
    }
    if (params.isActive !== undefined) {
      httpParams = httpParams.set('isActive', params.isActive.toString());
    }
    if (params.limit !== undefined) {
      httpParams = httpParams.set('limit', params.limit.toString());
    }
    if (params.offset !== undefined) {
      httpParams = httpParams.set('offset', params.offset.toString());
    }

    return this.http.get<BranchListResponse>(`${this.apiUrl}/branches/restaurant/${restaurantId}`, {
      params: httpParams,
    });
  }

  create(newBranch: Partial<Branch>): Observable<Branch> {
    const restaurantId = this.orgService.selectedRestaurantId();

    if (!restaurantId) {
      throw new Error('No restaurant selected');
    }

    return this.http
      .post<BranchResponse>(`${this.apiUrl}/branches/${restaurantId}`, newBranch)
      .pipe(
        map((response) => response.branch),
        tap(() => this.orgService.refreshGlobalBranches())
      );
  }

  update(branchId: string, updatedBranch: Partial<Branch>): Observable<Branch> {
    const restaurantId = this.orgService.selectedRestaurantId();

    if (!restaurantId) {
      throw new Error('No restaurant selected');
    }

    return this.http
      .patch<BranchResponse>(`${this.apiUrl}/branches/restaurant/${restaurantId}/${branchId}`, {
        ...updatedBranch,
      })
      .pipe(
        map((response) => response.branch),
        tap(() => this.orgService.refreshGlobalBranches())
      );
  }

  activate(branchId: string): Observable<Branch> {
    const restaurantId = this.orgService.selectedRestaurantId();

    if (!restaurantId) {
      throw new Error('No restaurant selected');
    }

    return this.http
      .patch<BranchResponse>(`${this.apiUrl}/branches/activate/${restaurantId}/${branchId}`, {})
      .pipe(
        map((response) => response.branch),
        tap(() => this.orgService.refreshGlobalBranches())
      );
  }

  deactivate(branchId: string): Observable<Branch> {
    const restaurantId = this.orgService.selectedRestaurantId();

    if (!restaurantId) {
      throw new Error('No restaurant selected');
    }

    return this.http
      .delete<BranchResponse>(`${this.apiUrl}/branches/${restaurantId}/${branchId}`)
      .pipe(
        map((response) => response.branch),
        tap(() => this.orgService.refreshGlobalBranches())
      );
  }

  listStaff(branchId: string): Observable<StaffMember[]> {
    return this.http
      .get<StaffListResponse>(this.staffUrl(branchId))
      .pipe(map((response) => response.staff));
  }

  addStaff(branchId: string, email: string): Observable<StaffMember> {
    return this.http
      .post<{ staff: StaffMember }>(this.staffUrl(branchId), { email })
      .pipe(map((response) => response.staff));
  }

  removeStaff(branchId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.staffUrl(branchId)}/${userId}`);
  }

  private staffUrl(branchId: string): string {
    const restaurantId = this.orgService.selectedRestaurantId();

    if (!restaurantId) {
      throw new Error('No restaurant selected');
    }

    return `${this.apiUrl}/branches/${restaurantId}/${branchId}/staff`;
  }

  bulkUploadByCsv(file: File): Observable<BranchesBulkResponse> {
    const restaurantId = this.orgService.selectedRestaurantId();

    if (!restaurantId) {
      throw new Error('No restaurant selected');
    }

    const form = new FormData();
    form.append('file', file);

    return this.http
      .post<BranchesBulkResponse>(`${this.apiUrl}/branches/bulk-upload/${restaurantId}`, form)
      .pipe(tap(() => this.orgService.refreshGlobalBranches()));
  }
}
