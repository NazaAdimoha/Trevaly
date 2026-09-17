import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { ENV, type Env } from '../config/config.module';

/**
 * Signed Cloudinary uploads — ported from web's `lib/media/cloudinary.ts`.
 * The browser uploads straight to Cloudinary; the API only signs.
 */
@Injectable()
export class CloudinaryService {
  constructor(@Inject(ENV) private readonly env: Env) {}

  config() {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = this.env;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      throw new Error('Cloudinary is not configured');
    }
    return {
      cloudName: CLOUDINARY_CLOUD_NAME,
      apiKey: CLOUDINARY_API_KEY,
      apiSecret: CLOUDINARY_API_SECRET,
    };
  }

  /** Parameters sorted by key, `k=v` joined with `&`, secret appended, SHA-1. */
  sign(params: Record<string, string | number>, apiSecret: string): string {
    const toSign = Object.keys(params)
      .filter((key) => key !== 'signature' && key !== 'api_key')
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
    return createHash('sha1').update(`${toSign}${apiSecret}`).digest('hex');
  }

  /**
   * Upload into a tenant's folder from a remote URL, for the CSV import.
   * Cloudinary does the fetching, so a spreadsheet cannot make this server
   * request an internal address. `folder` must come from `tenantUploadFolder()`.
   */
  async uploadFromUrl(params: {
    url: string;
    folder: string;
  }): Promise<{ publicId: string } | { error: string }> {
    const { cloudName, apiKey, apiSecret } = this.config();
    const timestamp = Math.floor(Date.now() / 1000);

    const body = new URLSearchParams({
      file: params.url,
      folder: params.folder,
      timestamp: String(timestamp),
      api_key: apiKey,
      signature: this.sign({ folder: params.folder, timestamp }, apiSecret),
    });

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body,
        signal: AbortSignal.timeout(30_000),
      });
      const json = (await res.json()) as { public_id?: string; error?: { message?: string } };
      if (!res.ok || !json.public_id) {
        // Reported per row rather than thrown: one unreachable image must not
        // abandon an import of two hundred products.
        return { error: json.error?.message ?? `Upload failed (${res.status})` };
      }
      return { publicId: json.public_id };
    } catch {
      return { error: 'Could not reach Cloudinary' };
    }
  }
}
