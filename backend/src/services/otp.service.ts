import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import User, { UserDocument } from '../models/User';
import OtpVerification, { OtpPurpose, OtpVerificationDocument } from '../models/OtpVerification';
import { otpDeliveryService } from './otp-delivery.service';
import { auditService, AuditContext } from '../audit/audit.service';

const DEFAULT_OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_MAX_ATTEMPTS = 3;

export interface VerifyOtpResult {
  success: boolean;
  message: string;
  statusCode: number;
  user?: UserDocument;
}

export class OtpService {
  /**
   * Generates a cryptographically secure 6-digit numeric OTP.
   */
  generateOtp(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Creates, hashes, persists, and delivers an OTP for the given user and purpose.
   */
  async createAndSendOtp(
    user: UserDocument,
    purpose: OtpPurpose,
    context?: AuditContext
  ): Promise<{ success: boolean; expiresAt: Date }> {
    const email = user.email.toLowerCase().trim();

    // Invalidate any existing active OTPs for this user and purpose
    await OtpVerification.updateMany(
      {
        userId: user._id,
        purpose,
        consumed: false
      },
      {
        $set: {
          consumed: true,
          consumedAt: new Date()
        }
      }
    );

    const plainOtp = this.generateOtp();
    const otpHash = await bcrypt.hash(plainOtp, 10);

    const expiryMs = Number(process.env.OTP_EXPIRY_MS) || DEFAULT_OTP_EXPIRY_MS;
    const maxAttempts = Number(process.env.OTP_MAX_ATTEMPTS) || DEFAULT_MAX_ATTEMPTS;
    const expiresAt = new Date(Date.now() + expiryMs);

    const otpDoc = await OtpVerification.create({
      userId: user._id,
      email,
      purpose,
      otpHash,
      expiresAt,
      attempts: 0,
      maxAttempts,
      consumed: false
    });

    await otpDeliveryService.sendOtp(
      {
        email: user.email,
        name: user.name,
        phone: user.phone
      },
      purpose,
      plainOtp
    );

    const action = purpose === 'REGISTER' ? 'REGISTRATION_OTP_SENT' : 'LOGIN_OTP_SENT';
    await auditService.record({
      actorId: user._id.toString(),
      actorRole: user.role,
      action,
      resource: 'otp',
      resourceId: otpDoc._id.toString(),
      requestId: context?.requestId,
      outcome: 'SUCCESS',
      metadata: {
        purpose,
        expiresAt
      }
    });

    return { success: true, expiresAt };
  }

  /**
   * Validates a supplied OTP against the database record with attempt tracking,
   * single-use consumption, and expiration enforcement.
   */
  async verifyOtp(
    identifier: { email?: string; userId?: string },
    purpose: OtpPurpose,
    plainOtp: string,
    context?: AuditContext
  ): Promise<VerifyOtpResult> {
    if (!plainOtp || typeof plainOtp !== 'string' || !/^\d{6}$/.test(plainOtp.trim())) {
      return {
        success: false,
        message: 'A valid 6-digit OTP is required',
        statusCode: 400
      };
    }

    let user: UserDocument | null = null;
    if (identifier.userId) {
      user = await User.findById(identifier.userId);
    } else if (identifier.email) {
      user = await User.findOne({ email: identifier.email.toLowerCase().trim() });
    }

    if (!user) {
      return {
        success: false,
        message: 'User account not found',
        statusCode: 404
      };
    }

    const trimmedOtp = plainOtp.trim();

    // Find the latest unconsumed OTP record for this user and purpose
    const otpRecord = await OtpVerification.findOne({
      userId: user._id,
      purpose,
      consumed: false
    }).sort({ createdAt: -1 });

    const failureAction = purpose === 'REGISTER' ? 'REGISTRATION_OTP_FAILED' : 'LOGIN_OTP_FAILED';

    if (!otpRecord) {
      await auditService.record({
        actorId: user._id.toString(),
        actorRole: user.role,
        action: failureAction,
        resource: 'otp',
        requestId: context?.requestId,
        outcome: 'FAILURE',
        metadata: { reason: 'no_active_otp_found', purpose }
      });
      return {
        success: false,
        message: 'No active OTP request found. Please request a new OTP.',
        statusCode: 400
      };
    }

    // Check expiration
    if (otpRecord.expiresAt <= new Date()) {
      otpRecord.consumed = true;
      otpRecord.consumedAt = new Date();
      await otpRecord.save();

      await auditService.record({
        actorId: user._id.toString(),
        actorRole: user.role,
        action: 'OTP_EXPIRED',
        resource: 'otp',
        resourceId: otpRecord._id.toString(),
        requestId: context?.requestId,
        outcome: 'FAILURE',
        metadata: { purpose }
      });

      return {
        success: false,
        message: 'OTP has expired. Please request a new OTP.',
        statusCode: 400
      };
    }

    // Check max attempts
    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      otpRecord.consumed = true;
      otpRecord.consumedAt = new Date();
      await otpRecord.save();

      await auditService.record({
        actorId: user._id.toString(),
        actorRole: user.role,
        action: 'OTP_MAX_ATTEMPTS_REACHED',
        resource: 'otp',
        resourceId: otpRecord._id.toString(),
        requestId: context?.requestId,
        outcome: 'FAILURE',
        metadata: { purpose, attempts: otpRecord.attempts }
      });

      return {
        success: false,
        message: 'Maximum OTP verification attempts exceeded. Please request a new OTP.',
        statusCode: 400
      };
    }

    // Reserve an attempt atomically before comparing. Parallel requests share
    // the same database limit instead of overwriting each other's counters.
    const attemptedOtp = await OtpVerification.findOneAndUpdate(
      {
        _id: otpRecord._id,
        consumed: false,
        expiresAt: { $gt: new Date() },
        attempts: { $lt: otpRecord.maxAttempts }
      },
      { $inc: { attempts: 1 } },
      { new: true }
    );
    if (!attemptedOtp) {
      return { success: false, message: 'OTP is no longer active. Please request a new OTP.', statusCode: 400 };
    }

    const isMatch = await bcrypt.compare(trimmedOtp, attemptedOtp.otpHash);

    if (!isMatch) {
      otpRecord.attempts = attemptedOtp.attempts;
      const reachedMax = attemptedOtp.attempts >= attemptedOtp.maxAttempts;
      if (reachedMax) {
        await OtpVerification.updateOne(
          { _id: otpRecord._id, consumed: false },
          { $set: { consumed: true, consumedAt: new Date() } }
        );
      }

      await auditService.record({
        actorId: user._id.toString(),
        actorRole: user.role,
        action: reachedMax ? 'OTP_MAX_ATTEMPTS_REACHED' : failureAction,
        resource: 'otp',
        resourceId: otpRecord._id.toString(),
        requestId: context?.requestId,
        outcome: 'FAILURE',
        metadata: {
          purpose,
          attempts: otpRecord.attempts,
          maxAttempts: otpRecord.maxAttempts
        }
      });

      const remainingAttempts = Math.max(0, otpRecord.maxAttempts - otpRecord.attempts);
      const attemptMsg = remainingAttempts > 0
        ? `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`
        : 'Maximum OTP verification attempts exceeded. Please request a new OTP.';

      return {
        success: false,
        message: attemptMsg,
        statusCode: 400
      };
    }

    // Only one concurrent verification can consume the active OTP.
    const consumedOtp = await OtpVerification.findOneAndUpdate(
      { _id: otpRecord._id, consumed: false, expiresAt: { $gt: new Date() } },
      { $set: { consumed: true, consumedAt: new Date() } },
      { new: true }
    );
    if (!consumedOtp) {
      return { success: false, message: 'OTP is no longer active. Please request a new OTP.', statusCode: 400 };
    }

    const successAction = purpose === 'REGISTER' ? 'REGISTRATION_OTP_VERIFIED' : 'LOGIN_OTP_VERIFIED';
    await auditService.record({
      actorId: user._id.toString(),
      actorRole: user.role,
      action: successAction,
      resource: 'otp',
      resourceId: otpRecord._id.toString(),
      requestId: context?.requestId,
      outcome: 'SUCCESS',
      metadata: { purpose }
    });

    return {
      success: true,
      message: 'OTP verified successfully',
      statusCode: 200,
      user
    };
  }

  /**
   * Resends a new OTP for the user and purpose, invalidating the previous one.
   */
  async resendOtp(
    identifier: { email?: string; userId?: string },
    purpose: OtpPurpose,
    context?: AuditContext
  ): Promise<{ success: boolean; message: string; statusCode: number }> {
    let user: UserDocument | null = null;
    if (identifier.userId) {
      user = await User.findById(identifier.userId);
    } else if (identifier.email) {
      user = await User.findOne({ email: identifier.email.toLowerCase().trim() });
    }

    if (!user) {
      return {
        success: false,
        message: 'User account not found',
        statusCode: 404
      };
    }

    if (purpose === 'REGISTER' && user.isVerified) {
      return {
        success: false,
        message: 'Account is already verified. Please log in.',
        statusCode: 400
      };
    }

    if (purpose === 'LOGIN') {
      // Resend continues a password-validated login; it must not initiate one.
      const pendingLogin = user.isVerified && await OtpVerification.exists({
        userId: user._id,
        purpose: 'LOGIN',
        consumed: false,
        expiresAt: { $gt: new Date() }
      });
      if (!pendingLogin) {
        return { success: false, message: 'Please enter your login credentials to request a new OTP.', statusCode: 400 };
      }
    }

    await this.createAndSendOtp(user, purpose, context);

    await auditService.record({
      actorId: user._id.toString(),
      actorRole: user.role,
      action: 'OTP_RESENT',
      resource: 'otp',
      requestId: context?.requestId,
      outcome: 'SUCCESS',
      metadata: { purpose }
    });

    return {
      success: true,
      message: `${purpose === 'REGISTER' ? 'Registration' : 'Login'} OTP has been resent to your email.`,
      statusCode: 200
    };
  }
}

export const otpService = new OtpService();
