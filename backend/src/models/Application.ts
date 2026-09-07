import { Document, Schema, Types, model } from 'mongoose';

export type ApplicationStatus =
  | 'submitted'
  | 'under_review'
  | 'verified'
  | 'rejected'
  | 'withdrawn';

export interface ApplicationDocument extends Document {
  citizenId: Types.ObjectId;
  applicationNumber: string;
  jobId: string;
  department: string;
  position: string;
  status: ApplicationStatus;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const applicationSchema = new Schema<ApplicationDocument>(
  {
    citizenId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    applicationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    jobId: {
      type: String,
      required: true,
      trim: true
    },

    department: {
      type: String,
      required: true,
      trim: true
    },

    position: {
      type: String,
      required: true,
      trim: true
    },

    status: {
      type: String,
      enum: [
        'submitted',
        'under_review',
        'verified',
        'rejected',
        'withdrawn'
      ],
      default: 'submitted'
    },

    submittedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

const Application = model<ApplicationDocument>(
  'Application',
  applicationSchema
);

export default Application;