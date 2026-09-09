import { apiClient } from './client';
import {
  RegisterPayload,
  RegisterResponse,
  LoginPayload,
  LoginResponse,
  VerifyOtpPayload,
  VerifyRegisterOtpResponse,
  ResendOtpPayload,
  User
} from '../types/auth.types';

export const authApi = {
  // Step 1: Register unverified account
  async register(payload: RegisterPayload): Promise<RegisterResponse> {
    const { data } = await apiClient.post<RegisterResponse>('/auth/register', payload);
    return data;
  },

  // Step 2: Verify registration OTP & mark account verified
  async verifyRegisterOtp(payload: VerifyOtpPayload): Promise<VerifyRegisterOtpResponse> {
    const { data } = await apiClient.post<VerifyRegisterOtpResponse>('/auth/register/verify-otp', payload);
    return data;
  },

  // Resend registration OTP
  async resendRegisterOtp(payload: ResendOtpPayload): Promise<{ message: string }> {
    const { data } = await apiClient.post<{ message: string }>('/auth/register/resend-otp', payload);
    return data;
  },

  // Verified accounts receive a JWT directly after password validation
  async login(payload: LoginPayload): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>('/auth/login', payload);
    return data;
  },

  // Get current authenticated user profile
  async getMe(): Promise<{ user: User }> {
    const { data } = await apiClient.get<{ user: User }>('/auth/me');
    return data;
  }
};
