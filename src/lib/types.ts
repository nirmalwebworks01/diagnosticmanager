// src/lib/types.ts

export interface Entry {
  id: string;
  date: string; // ISO date string YYYY-MM-DD
  patientName: string;
  totalAmount: number;
  receivedAmount: number;
  companyAmount: number;
  referBy: string;
  referAmount: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}

export type Role = 'admin' | 'staff';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Referrer {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
}

export interface EntryCalculations {
  due: number;
  grossProfit: number;
  netProfit: number;
}

export type LogAction = 'CREATE_ENTRY' | 'UPDATE_ENTRY' | 'DELETE_ENTRY' | 'CREATE_USER' | 'TOGGLE_USER_STATUS' | 'LOGIN';

export interface ActivityLog {
  id: string;
  action: LogAction;
  details: string;
  userId: string;
  userName: string;
  userEmail: string;
  timestamp: string;
}
