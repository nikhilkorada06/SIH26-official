import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { validateAndLoadConfig } from '../config/env';
import User from '../models/User';
import Application from '../models/Application';
import UploadedDocument from '../models/UploadedDocument';
import { uploadDocument } from '../services/cloudinary.service';

const DEMO_EMAIL = 'muhammadsaqib01@gmail.com';
const DEMO_DOCUMENT_TYPE = 'MahaSetu Demo Identity Document';

function escapePdfText(value: string): string {
  return value.replace(/([\\()])/g, '\\$1');
}

function createDemoPdf(): Buffer {
  const lines = [
    'DEMO DOCUMENT',
    'NOT A REAL GOVERNMENT DOCUMENT',
    'FOR SIH MAHASETU DEMONSTRATION ONLY',
    'Name: Muhammad Saqib',
    'College: NIT Agartala',
    'Identity data in this file is synthetic.'
  ];
  const content = lines.map((line, index) => `BT /F1 ${index === 0 ? 20 : 12} Tf 72 ${740 - index * 42} Td (${escapePdfText(line)}) Tj ET`).join('\n');
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj',
    `5 0 obj << /Length ${Buffer.byteLength(content)} >> stream\n${content}\nendstream endobj`
  ];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  for (const object of objects) { offsets.push(Buffer.byteLength(pdf)); pdf += `${object}\n`; }
  const xref = Buffer.byteLength(pdf); pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

async function main(): Promise<void> {
  const password = process.env.DEMO_CITIZEN_PASSWORD;
  if (!password || password.length < 12) throw new Error('DEMO_CITIZEN_PASSWORD must be set locally and contain at least 12 characters');
  const config = validateAndLoadConfig(); await mongoose.connect(config.mongoUri);
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.findOneAndUpdate(
      { email: DEMO_EMAIL },
      { $set: { name: 'Muhammad Saqib', password: hashedPassword, role: 'citizen', isVerified: true, phone: '9000000101', dateOfBirth: '2001-01-15', registrationNumber: 'DEMO-MH-CITIZEN-001', college: 'NIT Agartala', gender: 'Male', address: '101 Demo Campus Road', district: 'Demo District', state: 'Maharashtra', pincode: '400000', education: 'Bachelor of Technology — Demo Profile', category: 'General — Demo' }, $setOnInsert: { email: DEMO_EMAIL } },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );
    let application = await Application.findOne({ citizenId: user._id, jobId: 'DEMO-PROFILE-DOCUMENT' });
    if (!application) application = await Application.create({ citizenId: user._id, applicationNumber: 'DEMO-CITIZEN-PROFILE-001', jobId: 'DEMO-PROFILE-DOCUMENT', department: 'MahaSetu Demo Services', position: 'Demo Citizen Profile', status: 'submitted', applicationKind: 'standard' });
    const existing = await UploadedDocument.findOne({ userId: user._id, applicationId: application._id, documentType: DEMO_DOCUMENT_TYPE });
    if (!existing) {
      const pdf = createDemoPdf(); const uploaded = await uploadDocument(pdf, application._id.toString(), 'raw');
      await UploadedDocument.create({ applicationId: application._id, userId: user._id, originalFileName: 'mahasetu-demo-identity-document.pdf', cloudinaryPublicId: uploaded.public_id, cloudinarySecureUrl: uploaded.secure_url, resourceType: 'raw', format: uploaded.format || 'pdf', mimeType: 'application/pdf', fileSize: pdf.length, documentType: DEMO_DOCUMENT_TYPE });
    }
    console.log(`Demo citizen seeded successfully for ${DEMO_EMAIL}; demo document is available.`);
  } finally { await mongoose.disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Demo citizen seed failed'); process.exit(1); });
