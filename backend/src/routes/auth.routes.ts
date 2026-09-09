import { Request, Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User, { UserDocument } from '../models/User';
import authenticateToken from '../middleware/auth';
import { AuthUser } from '../types/auth';
import requireRole from '../middleware/role';
import { auditService } from '../audit/audit.service';
import { authRateLimiter } from '../middleware/rate-limiter';
import { otpService } from '../services/otp.service';
import { otpDeliveryService } from '../services/otp-delivery.service';

interface RegisterBody {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  dateOfBirth?: unknown;
  phone?: unknown;
  registrationNumber?: unknown;
}

interface VerifyOtpBody {
  email?: unknown;
  userId?: unknown;
  otp?: unknown;
}

interface ResendOtpBody {
  email?: unknown;
  userId?: unknown;
}

interface LoginBody {
  email?: unknown;
  password?: unknown;
}

const router = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9][0-9\s-]{6,19}$/;
const minimumPasswordLength = 8;

// Local browser-testing helper. This route is never registered in production
// and must also be explicitly enabled in the local environment.
if (
  process.env.NODE_ENV !== 'production' &&
  process.env.DEV_OTP_RETRIEVAL_ENABLED === 'true'
) {
  router.get('/dev/otp', authRateLimiter, (req: Request, res: Response) => {
    const email = typeof req.query.email === 'string' ? req.query.email.trim() : '';
    const purpose = req.query.purpose;

    res.setHeader('Cache-Control', 'no-store');

    if (!emailPattern.test(email) || (purpose !== 'REGISTER' && purpose !== 'LOGIN')) {
      return res.status(400).json({ message: 'Valid email and OTP purpose are required' });
    }

    const otp = otpDeliveryService.getDevLatestOtp(email, purpose);
    if (!otp) {
      return res.status(404).json({ message: 'No development OTP is available' });
    }

    return res.json({ otp, purpose });
  });
}

function userResponse(user: UserDocument): {
  id: string;
  name: string;
  email: string;
  role: AuthUser['role'];
  isVerified: boolean;
  dateOfBirth?: string;
  phone?: string;
  registrationNumber?: string;
} {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified ?? false,
    ...(user.dateOfBirth && { dateOfBirth: user.dateOfBirth }),
    ...(user.phone && { phone: user.phone }),
    ...(user.registrationNumber && { registrationNumber: user.registrationNumber })
  };
}

// ----------------------------------------------------------------------
// Registration Flow
// ----------------------------------------------------------------------

router.post('/register', authRateLimiter, async (req: Request<{}, {}, RegisterBody>, res: Response) => {
  const { name, email, password, dateOfBirth, phone, registrationNumber } = req.body;

  if (
    typeof name !== 'string' ||
    !name.trim() ||
    typeof email !== 'string' ||
    !emailPattern.test(email) ||
    typeof password !== 'string' ||
    password.length < minimumPasswordLength
  ) {
    return res.status(400).json({
      message: 'Name, valid email, and password of at least 8 characters are required'
    });
  }

  if (dateOfBirth !== undefined) {
    if (typeof dateOfBirth !== 'string' || Number.isNaN(new Date(dateOfBirth).getTime())) {
      return res.status(400).json({ message: 'dateOfBirth must be a valid date string' });
    }
  }

  if (phone !== undefined) {
    if (typeof phone !== 'string' || !phonePattern.test(phone.trim())) {
      return res.status(400).json({ message: 'phone must be a valid phone number' });
    }
  }

  if (registrationNumber !== undefined) {
    if (typeof registrationNumber !== 'string' || !registrationNumber.trim()) {
      return res.status(400).json({ message: 'registrationNumber must be a non-empty string' });
    }
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({ message: 'Email is already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      isVerified: false,
      ...(dateOfBirth && { dateOfBirth: dateOfBirth.trim() }),
      ...(phone && { phone: phone.trim() }),
      ...(registrationNumber && { registrationNumber: registrationNumber.trim() })
    });

    await auditService.record({
      actorId: user._id.toString(),
      actorRole: user.role,
      action: 'USER_REGISTERED_PENDING_VERIFICATION',
      resource: 'user',
      resourceId: user._id.toString(),
      requestId: req.requestId,
      outcome: 'SUCCESS',
      metadata: {
        email: normalizedEmail,
        role: user.role
      }
    });

    // Generate & dispatch registration OTP
    await otpService.createAndSendOtp(user, 'REGISTER', { requestId: req.requestId });

    return res.status(201).json({
      message: 'Registration successful. Please verify the OTP sent to your email to activate your account.',
      userId: user._id.toString(),
      email: user.email,
      requiresOtp: true,
      user: userResponse(user)
    });
  } catch (error: unknown) {
    if (isDuplicateKeyError(error)) {
      await auditService.record({
        actorId: null,
        action: 'USER_REGISTERED',
        resource: 'user',
        requestId: req.requestId,
        outcome: 'FAILURE',
        metadata: { reason: 'duplicate_email' }
      });
      return res.status(409).json({ message: 'Email is already registered' });
    }

    await auditService.record({
      actorId: null,
      action: 'USER_REGISTERED',
      resource: 'user',
      requestId: req.requestId,
      outcome: 'FAILURE',
      metadata: { reason: 'internal_error' }
    });
    return res.status(500).json({ message: 'Registration failed' });
  }
});

router.post('/register/verify-otp', authRateLimiter, async (req: Request<{}, {}, VerifyOtpBody>, res: Response) => {
  const { email, userId, otp } = req.body;

  if (typeof otp !== 'string' || !otp.trim()) {
    return res.status(400).json({ message: 'A valid 6-digit OTP is required' });
  }

  if (
    (email === undefined || typeof email !== 'string' || !email.trim()) &&
    (userId === undefined || typeof userId !== 'string' || !userId.trim())
  ) {
    return res.status(400).json({ message: 'Email or userId is required for OTP verification' });
  }

  try {
    const result = await otpService.verifyOtp(
      {
        email: typeof email === 'string' ? email : undefined,
        userId: typeof userId === 'string' ? userId : undefined
      },
      'REGISTER',
      otp,
      { requestId: req.requestId }
    );

    if (!result.success || !result.user) {
      return res.status(result.statusCode).json({ message: result.message });
    }

    const user = result.user;
    user.isVerified = true;
    await user.save();

    await auditService.record({
      actorId: user._id.toString(),
      actorRole: user.role,
      action: 'USER_REGISTERED',
      resource: 'user',
      resourceId: user._id.toString(),
      requestId: req.requestId,
      outcome: 'SUCCESS',
      metadata: {
        email: user.email,
        role: user.role
      }
    });

    return res.status(200).json({
      message: 'Account verified successfully. You can now log in.',
      user: userResponse(user)
    });
  } catch (error: unknown) {
    return res.status(500).json({ message: 'Registration OTP verification failed' });
  }
});

router.post('/register/resend-otp', authRateLimiter, async (req: Request<{}, {}, ResendOtpBody>, res: Response) => {
  const { email, userId } = req.body;

  if (
    (email === undefined || typeof email !== 'string' || !email.trim()) &&
    (userId === undefined || typeof userId !== 'string' || !userId.trim())
  ) {
    return res.status(400).json({ message: 'Email or userId is required to resend OTP' });
  }

  try {
    const result = await otpService.resendOtp(
      {
        email: typeof email === 'string' ? email : undefined,
        userId: typeof userId === 'string' ? userId : undefined
      },
      'REGISTER',
      { requestId: req.requestId }
    );

    return res.status(result.statusCode).json({ message: result.message });
  } catch (error: unknown) {
    return res.status(500).json({ message: 'Failed to resend registration OTP' });
  }
});

// ----------------------------------------------------------------------
// Login Flow (email/password -> JWT)
// ----------------------------------------------------------------------

router.post('/login', authRateLimiter, async (req: Request<{}, {}, LoginBody>, res: Response) => {
  const { email, password } = req.body;

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    const passwordMatches = user && (await bcrypt.compare(password, user.password));

    if (!passwordMatches) {
      await auditService.record({
        actorId: user?._id?.toString() ?? null,
        ...(user && { actorRole: user.role }),
        action: 'USER_LOGIN',
        resource: 'user',
        ...(user && { resourceId: user._id.toString() }),
        requestId: req.requestId,
        outcome: 'FAILURE',
        metadata: { reason: 'invalid_credentials' }
      });
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.isVerified) {
      await auditService.record({
        actorId: user._id.toString(),
        actorRole: user.role,
        action: 'USER_LOGIN',
        resource: 'user',
        resourceId: user._id.toString(),
        requestId: req.requestId,
        outcome: 'FAILURE',
        metadata: { reason: 'account_not_verified' }
      });
      return res.status(403).json({
        message: 'Account is not verified. Please complete registration OTP verification.',
        requiresVerification: true,
        email: user.email,
        userId: user._id.toString()
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return res.status(500).json({ message: 'JWT secret is not configured' });
    const token = jwt.sign(
      { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: '1h' }
    );
    await auditService.record({
      actorId: user._id.toString(), actorRole: user.role, action: 'USER_LOGIN',
      resource: 'user', resourceId: user._id.toString(), requestId: req.requestId, outcome: 'SUCCESS'
    });

    return res.status(200).json({
      message: 'Login successful',
      requiresOtp: false,
      token,
      user: userResponse(user)
    });
  } catch (error: unknown) {
    return res.status(500).json({ message: 'Login failed' });
  }
});

router.post('/login/verify-otp', authRateLimiter, async (_req: Request<{}, {}, VerifyOtpBody>, res: Response) => {
  return res.status(410).json({ message: 'Login OTP verification is no longer required' });
});

router.post('/login/resend-otp', authRateLimiter, async (_req: Request<{}, {}, ResendOtpBody>, res: Response) => {
  return res.status(410).json({ message: 'Login OTP is no longer used' });
});

// ----------------------------------------------------------------------
// User Profile & Role Test Endpoints
// ----------------------------------------------------------------------

router.get('/me', authenticateToken, (req: Request, res: Response) => {
  return res.json({ user: req.user });
});

router.get(
  '/test-admin',
  authenticateToken,
  requireRole('admin'),
  (req, res) => {
    res.json({ message: 'Admin access granted' });
  }
);

router.get(
  '/test-officer',
  authenticateToken,
  requireRole('admin', 'department_officer'),
  (req, res) => {
    res.json({ message: 'Officer/Admin access granted' });
  }
);

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

export default router;
