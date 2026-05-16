import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  async uploadImage(file: Express.Multer.File): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        { folder: 'wetalk/avatars' },
        (error, result) => {
          if (error) return reject(new Error(error.message || 'Upload failed'));
          if (result) {
            resolve(result);
          } else {
            reject(new Error('Upload failed: result is undefined'));
          }
        },
      );
      Readable.from(file.buffer).pipe(upload);
    });
  }
}
