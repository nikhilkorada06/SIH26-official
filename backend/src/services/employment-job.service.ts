import EmploymentJob from '../models/EmploymentJob';
import { DEMO_EMPLOYMENT_JOBS } from '../data/employment-jobs';

export async function seedEmploymentJobs(): Promise<void> {
  await Promise.all(DEMO_EMPLOYMENT_JOBS.map(job => EmploymentJob.updateOne({ jobId: job.jobId }, { $set: job }, { upsert: true })));
}
