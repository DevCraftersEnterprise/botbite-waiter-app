import { Pagination } from './common.types';
import { MenuItem } from './menus.types';

export interface Order {
  id: string;
  total: number;
  customerId: string;
  branchId: string;
  orderItems: OrderItem[];
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface OrderItem {
  id: string;
  price: number;
  notes?: string | null;
  menuItem: MenuItem;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface OrderListResponse {
  orders: Order[];
  total: number;
  pagination: Pagination;
}
