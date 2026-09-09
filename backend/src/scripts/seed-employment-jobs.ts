import 'dotenv/config';
import mongoose from 'mongoose';
import { validateAndLoadConfig } from '../config/env';
import { seedEmploymentJobs } from '../services/employment-job.service';
(async () => { const config = validateAndLoadConfig(); await mongoose.connect(config.mongoUri); await seedEmploymentJobs(); console.log('Employment demo jobs seeded.'); await mongoose.disconnect(); })().catch(error => { console.error(error instanceof Error ? error.message : 'Seed failed'); process.exit(1); });
