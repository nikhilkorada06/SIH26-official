export type UserRole = 'admin' | 'department_officer' | 'citizen';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isVerified?: boolean;
  dateOfBirth?: string;
  phone?: string;
  registrationNumber?: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  dateOfBirth?: string;
  phone?: string;
  registrationNumber?: string;
}

export interface RegisterResponse {
  message: string;
  userId?: string;
  email?: string;
  requiresOtp: boolean;
  user: User;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  requiresOtp: boolean;
  token: string;
  user: User;
  userId?: string;
  email?: string;
  requiresVerification?: boolean;
}

export interface VerifyOtpPayload {
  email?: string;
  userId?: string;
  otp: string;
}

export interface VerifyRegisterOtpResponse {
  message: string;
  user: User;
}

export interface ResendOtpPayload {
  email?: string;
  userId?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
