import { Document, Schema, Types, model } from 'mongoose';

export type OtpPurpose = 'REGISTER' | 'LOGIN';

export interface OtpVerificationDocument extends Document {
  userId: Types.ObjectId;
  email: string;
  purpose: OtpPurpose;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  consumed: boolean;
  consumedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const otpVerificationSchema = new Schema<OtpVerificationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    purpose: {
      type: String,
      enum: ['REGISTER', 'LOGIN'],
      required: true,
      index: true
    },
    otpHash: {
      type: String,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    attempts: {
      type: Number,
      default: 0,
      required: true
    },
    maxAttempts: {
      type: Number,
      default: 3,
      required: true
    },
    consumed: {
      type: Boolean,
      default: false,
      required: true,
      index: true
    },
    consumedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

otpVerificationSchema.index({ email: 1, purpose: 1, consumed: 1, expiresAt: 1 });
otpVerificationSchema.index({ userId: 1, purpose: 1, consumed: 1 });

const OtpVerification = model<OtpVerificationDocument>(
  'OtpVerification',
  otpVerificationSchema
);

export default OtpVerification;
