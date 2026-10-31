import { Pagination } from './common.types';

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  walletPct: number;
  logoUrl?: string | null;
  isActive: boolean;
  userId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface RestaurantListResponse {
  restaurants: Restaurant[];
  total: number;
  pagination: Pagination;
}

export interface RestaurantResponse {
  restaurant: Restaurant;
  message: string;
}
