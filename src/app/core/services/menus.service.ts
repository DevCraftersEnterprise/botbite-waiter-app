import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { OrgService } from './org.service';
import { environment } from '../../../environments/environment';
import {
  Menu,
  MenuItem,
  MenuItemListResponse,
  MenuItemResponse,
  MenuListResponse,
  MenuResponse,
  CreateMenuItemDto,
  UpdateMenuItemDto,
} from './types/menus.types';
import { MenuImportPreview, MenuImportResult } from './types/menu-csv.types';
import { map, Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MenusService {
  private readonly http = inject(HttpClient);
  private readonly orgService = inject(OrgService);
  private readonly apiUrl = environment.apiBaseUrl;

  readonly menus = signal<Menu[]>([]);
  readonly totalMenus = signal<number>(0);
  readonly menuItems = signal<MenuItem[]>([]);
  readonly totalMenuItems = signal<number>(0);

  readonly allMenuItems = signal<MenuItem[]>([]);

  //#region Menu
  createMenu(newMenu: Partial<Menu>): Observable<Menu> {
    const branchId = this.orgService.selectedBranchId();

    if (!branchId) throw new Error('No branch selected');

    return this.http
      .post<MenuResponse>(`${this.apiUrl}/menus/${branchId}`, newMenu)
      .pipe(map((response) => response.menu));
  }

  findMenusByBranch(params: {
    search?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Observable<Menu[]> {
    const branchId = this.orgService.selectedBranchId();

    if (!branchId) throw new Error('No branch selected');

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

    return this.http
      .get<MenuListResponse>(`${this.apiUrl}/menus/${branchId}`, { params: httpParams })
      .pipe(
        tap((response) => {
          this.menus.set(response.menus);
          this.totalMenus.set(response.total);
        }),
        map((response) => response.menus)
      );
  }

  uploadMenuFile(file: File, menuId: string): Observable<Menu> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post<MenuResponse>(`${this.apiUrl}/menus/menu/upload-file/${menuId}`, formData)
      .pipe(map((response) => response.menu));
  }

  updateMenu(menuId: string, updatedMenu: Partial<Menu>): Observable<Menu> {
    return this.http
      .patch<MenuResponse>(`${this.apiUrl}/menus/menu/${menuId}`, updatedMenu)
      .pipe(map((response) => response.menu));
  }

  removeMenu(menuId: string): Observable<Menu> {
    return this.http
      .delete<MenuResponse>(`${this.apiUrl}/menus/menu/${menuId}`)
      .pipe(map((response) => response.menu));
  }

  //#endregion

  //#region Menu CSV
  /** Qué haría la importación, sin guardar nada. */
  previewMenuCsv(menuId: string, file: File): Observable<MenuImportPreview> {
    return this.http.post<MenuImportPreview>(
      `${this.apiUrl}/menus/menu/${menuId}/import/preview`,
      this.csvForm(file)
    );
  }

  /** Guarda el menú del archivo. Con un error responde 400 y no guarda nada. */
  importMenuCsv(menuId: string, file: File): Observable<MenuImportResult> {
    return this.http.post<MenuImportResult>(
      `${this.apiUrl}/menus/menu/${menuId}/import`,
      this.csvForm(file)
    );
  }

  exportMenuCsv(menuId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/menus/menu/${menuId}/export`, {
      responseType: 'blob',
    });
  }

  private csvForm(file: File): FormData {
    const form = new FormData();
    form.append('file', file);
    return form;
  }
  //#endregion

  //#region Menu Items
  createMenuItem(menuId: string, dto: CreateMenuItemDto): Observable<MenuItem> {
    return this.http
      .post<MenuItemResponse>(`${this.apiUrl}/menus/menu/${menuId}/items`, dto)
      .pipe(map((res) => res.menuItem));
  }

  findItemsByMenu(
    menuId: string,
    params: {
      search?: string;
      isActive?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Observable<MenuItem[]> {
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

    return this.http
      .get<MenuItemListResponse>(`${this.apiUrl}/menus/menu/${menuId}/items`, {
        params: httpParams,
      })
      .pipe(
        tap((response) => {
          this.menuItems.set(response.items);
          this.totalMenuItems.set(response.total);
        }),

        map((response) => response.items)
      );
  }

  findAllItems(menuId: string): Observable<MenuItem[]> {
    return this.http
      .get<MenuItemListResponse>(`${this.apiUrl}/menus/menu/${menuId}/items`, {
        params: {
          limit: 200,
        },
      })
      .pipe(
        tap((response) => {
          this.allMenuItems.set(response.items);
        }),

        map((response) => response.items)
      );
  }

  updateMenuItem(
    menuId: string,
    itemId: string,
    updatedItem: UpdateMenuItemDto
  ): Observable<MenuItem> {
    return this.http
      .patch<MenuItemResponse>(`${this.apiUrl}/menus/menu/${menuId}/items/${itemId}`, updatedItem)
      .pipe(map((response) => response.menuItem));
  }

  removeMenuItem(menuId: string, itemId: string): Observable<MenuItem> {
    return this.http
      .delete<MenuItemResponse>(`${this.apiUrl}/menus/menu/${menuId}/items/${itemId}`)
      .pipe(map((response) => response.menuItem));
  }
  //#endregion
}
