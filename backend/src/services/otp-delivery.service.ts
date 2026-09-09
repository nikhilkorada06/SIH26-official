import { OtpPurpose } from '../models/OtpVerification';

export interface OtpRecipient {
  email: string;
  name?: string;
  phone?: string;
}

export interface OtpDeliveryService {
  sendOtp(recipient: OtpRecipient, purpose: OtpPurpose, otp: string): Promise<boolean>;
  getDevLatestOtp?(email: string, purpose: OtpPurpose): string | undefined;
  clearDevOtps?(): void;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain || local.length <= 2) {
    return `***@${domain || 'unknown'}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * In-memory development delivery provider.
 * Captures OTPs in memory exclusively for development and automated tests.
 * Never logs or exposes raw OTP in production.
 */
export class DevelopmentOtpDeliveryProvider implements OtpDeliveryService {
  private devOtpStore = new Map<string, string>();

  async sendOtp(recipient: OtpRecipient, purpose: OtpPurpose, otp: string): Promise<boolean> {
    const key = `${recipient.email.toLowerCase().trim()}:${purpose}`;
    this.devOtpStore.set(key, otp);

    const masked = maskEmail(recipient.email);
    console.log(`[DEV OTP DELIVERY] OTP dispatched to ${masked} for purpose: ${purpose}`);

    return true;
  }

  getDevLatestOtp(email: string, purpose: OtpPurpose): string | undefined {
    if (process.env.NODE_ENV === 'production') {
      return undefined;
    }
    const key = `${email.toLowerCase().trim()}:${purpose}`;
    return this.devOtpStore.get(key);
  }

  clearDevOtps(): void {
    this.devOtpStore.clear();
  }
}

export const otpDeliveryService: DevelopmentOtpDeliveryProvider = new DevelopmentOtpDeliveryProvider();
