export interface UserForm {
  email: string;
  password: string;
}

export interface CategoryForm {
  readonly id?: number;
  name: string;
  sortOrder?: number;
  isActive: boolean;
}

export interface RestaurantForm {
  readonly id?: string;
  name: string;
  walletPct?: number;
  isActive: boolean;
}

export interface BranchForm {
  readonly id?: string;
  name: string;
  address: string;
  phoneNumberAssistant?: string;
  phoneNumberReception?: string;
  isActive: boolean;
  surveyUrl: string;
}

export interface ProductForm {
  readonly id?: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface MenuForm {
  readonly id?: string;
  name: string;
  isActive: boolean;
}

export interface MenuItemForm {
  readonly id?: string;
  product: ProductForm[];
  category: CategoryForm;
  price: number;
  shouldRecommend: boolean;
  isActive: boolean;
}
