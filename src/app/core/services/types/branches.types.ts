import { Pagination } from './common.types';

export interface Branch {
  id: string;
  name: string;
  address: string;
  phoneNumberAssistant?: string | null;
  phoneNumberReception?: string | null;
  qrUrl?: string | null;
  surveyUrl?: string | null;
  availableMessages: number;
  restaurantId: string;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface BranchResponse {
  branch: Branch;
  message: string;
}

export interface BranchListResponse {
  branches: Branch[];
  total: number;
  pagination: Pagination;
}

/** Cajero o mesero (rol "user") asignado a una sucursal. */
export interface StaffMember {
  id: string;
  email: string;
  isActive: boolean;
  assignedAt: Date | string;
}

export interface StaffListResponse {
  staff: StaffMember[];
}

export interface BranchesBulkResponse {
  branches: Branch[];
  count: number;
  message: string;
}
