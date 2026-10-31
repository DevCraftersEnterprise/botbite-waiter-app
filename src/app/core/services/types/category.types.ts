import { Pagination } from './common.types';

export interface Category {
  id: number;
  name: string;
  restaurantId: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CategoryListResponse {
  categories: Category[];
  total: number;
  pagination: Pagination;
  message?: string;
}

export interface CategoryResponse {
  category: Category;
  message?: string;
}
