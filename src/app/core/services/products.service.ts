import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { map, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Product, ProductListResponse } from './types/products.types';

interface ProductResponse {
  product: Product;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class ProductsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiBaseUrl;

  readonly products = signal<Product[]>([]);
  readonly totalProducts = signal(0);

  createProduct(restaurantId: string, newProduct: Partial<Product>): Observable<ProductResponse> {
    return this.http.post<ProductResponse>(`${this.apiUrl}/products/${restaurantId}`, newProduct);
  }

  updateProduct(
    restaurantId: string,
    productId: string,
    updatedProduct: Partial<Product>
  ): Observable<ProductResponse> {
    return this.http
      .patch<ProductResponse>(
        `${this.apiUrl}/products/restaurant/${restaurantId}/${productId}`,
        updatedProduct
      )
      .pipe(
        tap((response) => {
          this.products.update((products) =>
            products.map((p) => (p.id === response.product.id ? response.product : p))
          );
        })
      );
  }

  activateProduct(restaurantId: string, productId: string): Observable<Product> {
    return this.http.patch<Product>(
      `${this.apiUrl}/products/activate/${restaurantId}/${productId}`,
      {}
    );
  }

  deactivateProduct(restaurantId: string, productId: string): Observable<Product> {
    return this.http.delete<Product>(`${this.apiUrl}/products/${restaurantId}/${productId}`, {});
  }

  uploadProductImage(restaurantId: string, productId: string, file: File): Observable<ProductResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .patch<ProductResponse>(
        `${this.apiUrl}/products/picture/${restaurantId}/${productId}`,
        formData
      )
      .pipe(
        tap((response) => {
          this.products.update((products) =>
            products.map((p) => (p.id === response.product.id ? response.product : p))
          );
        })
      );
  }

  findAllProductsByRestaurant(
    restaurantId: string,
    params: {
      search?: string;
      isActive?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Observable<ProductListResponse> {
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
      .get<ProductListResponse>(`${this.apiUrl}/products/restaurant/${restaurantId}`, {
        params: httpParams,
      })
      .pipe(
        map((response) => {
          this.products.set(response.products);
          this.totalProducts.set(response.total);
          return response;
        })
      );
  }
}
