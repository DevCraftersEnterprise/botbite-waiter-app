import { Category } from './category.types';
import { Pagination } from './common.types';
import { Product } from './products.types';

export interface Menu {
  id: string;
  name: string;
  pdfLink?: string;
  menuItems?: MenuItem[];
  isActive: boolean;
}

export interface MenuItem {
  id: string;
  price: number;
  category: Category;
  product: Product;
  isActive: boolean;
  shouldRecommend: boolean;
  variantGroup: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface MenuResponse {
  menu: Menu;
  message: string;
}

export interface MenuListResponse {
  menus: Menu[];
  total: number;
  pagination: Pagination;
}

export interface MenuItemResponse {
  menuItem: MenuItem;
  message: string;
}

export interface MenuItemListResponse {
  items: MenuItem[];
  total: number;
  pagination: Pagination;
}

export interface CreateMenuItemDto {
  productId: string;
  categoryId: number;
  price: number;
  isActive?: boolean;
  shouldRecommend?: boolean;
  variantGroup?: string | null;
}

export interface UpdateMenuItemDto {
  categoryId?: number;
  price?: number;
  isActive?: boolean;
  shouldRecommend?: boolean;
  variantGroup?: string | null;
}
