import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

function configureCloudinary(): void {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary is not configured');
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true
  });
}

export async function uploadDocument(
  buffer: Buffer,
  applicationId: string,
  resourceType: 'image' | 'raw'
): Promise<UploadApiResponse> {
  configureCloudinary();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder: `SIH/applications/${applicationId}/documents`,
      resource_type: resourceType,
      use_filename: false,
      unique_filename: true,
      overwrite: false
    }, (error, result) => {
      if (error || !result) reject(error || new Error('Cloudinary upload failed'));
      else resolve(result);
    });
    stream.end(buffer);
  });
}

export async function deleteDocument(publicId: string, resourceType: 'image' | 'raw'): Promise<void> {
  configureCloudinary();
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    invalidate: true
  });
  if (result.result !== 'ok' && result.result !== 'not found') {
    throw new Error('Cloudinary deletion failed');
  }
}
