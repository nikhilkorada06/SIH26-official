import mongoose, { Document, Model } from 'mongoose';
import { UserRole } from '../types/auth';

export interface UserDocument extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  dateOfBirth?: string;
  phone?: string;
  registrationNumber?: string;
}

const userSchema = new mongoose.Schema<UserDocument>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    select: false
  },
  role: {
    type: String,
    enum: ['citizen', 'department_officer', 'admin'],
    default: 'citizen'
  },
  dateOfBirth: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  registrationNumber: {
    type: String,
    trim: true
  }
});

const User: Model<UserDocument> = mongoose.model<UserDocument>('User', userSchema);

export default User;