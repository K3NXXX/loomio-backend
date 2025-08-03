import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import {
  v2 as CloudinaryType,
  UploadApiErrorResponse,
  UploadApiOptions,
  UploadApiResponse,
} from "cloudinary";
import * as streamifier from "streamifier";

@Injectable()
export class CloudinaryService {
  constructor(
    @Inject("CLOUDINARY") private cloudinary: typeof CloudinaryType,
  ) {}

  async uploadFile(
    file: Express.Multer.File,
    options?: UploadApiOptions,
  ): Promise<UploadApiResponse> {
    try {
      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const uploadStream = this.cloudinary.uploader.upload_stream(
          {
            upload_preset: "nextgen",
            ...options,
          },
          (
            error: UploadApiErrorResponse | undefined,
            result: UploadApiResponse | undefined,
          ) => {
            if (error) return reject(new Error(error.message));
            if (!result) return reject(new Error("Unknown upload error"));
            resolve(result);
          },
        );

        streamifier.createReadStream(file.buffer).pipe(uploadStream);
      });

      return result;
    } catch (err) {
      throw new InternalServerErrorException(
        `Cloudinary upload failed: ${(err as Error).message}`,
      );
    }
  }

  async deleteFile(publicId: string): Promise<UploadApiResponse> {
    try {
      const result = (await this.cloudinary.uploader.destroy(
        publicId,
      )) as UploadApiResponse;

      if (result.result !== "ok")
        throw new Error(`Cloudinary returned: ${result.result}`);

      return result;
    } catch (err) {
      throw new InternalServerErrorException(
        `Cloudinary deletion failed: ${(err as Error).message}`,
      );
    }
  }
}
