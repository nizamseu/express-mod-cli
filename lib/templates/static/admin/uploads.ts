import fs from 'fs';
import path from 'path';
import express, { type RequestHandler } from 'express';
import type { ActionRequest, FeatureType, ResourceOptions } from 'adminjs' with { 'resolution-mode': 'import' };
import config from './admin.config';
import type { ValidationErrorClass } from './zodHooks';

/**
 * Files uploaded in the admin panel (file and image fields) are kept in uploads/
 * and served at /uploads. The field stores the file's path inside uploads/.
 */
export const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
const UPLOADS_URL = '/uploads';

// SVG is left out: it can contain scripts
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'];

/**
 * Serves uploaded files. They are shown as files only - an uploaded HTML page
 * can't run scripts on this site.
 */
export function serveUploads(): RequestHandler {
  return express.static(UPLOADS_DIR, {
    index: false,
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox");
    },
  });
}

/** Characters that are safe in a file name and a URL */
const safeName = (name: string): string => name.replace(/[^\w.-]+/g, '_').slice(-120);

type UploadedFile = { path: string; type?: string; size: number; name: string };
type ProviderBase = new (bucket: string, opts?: object) => {
  bucket: string;
};
interface UploadPackage {
  // The package's own types are loaded with import(), so its functions are described loosely here
  uploadFeature: (options: Record<string, unknown>) => FeatureType;
  BaseProvider: ProviderBase;
  componentLoader: unknown;
  ValidationError: ValidationErrorClass;
  flat: { get(params: unknown, path: string): unknown };
}

/**
 * Makes upload features for file and image fields of the panel:
 *   features: [uploadFile('photo', { images: true })]
 */
export function createUploadFile({ uploadFeature, BaseProvider, componentLoader, ValidationError, flat }: UploadPackage) {
  class LocalUploads extends BaseProvider {
    constructor() {
      super(UPLOADS_DIR);
    }

    async upload(file: UploadedFile, key: string): Promise<void> {
      const target = path.join(UPLOADS_DIR, key);
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      // Copied, not moved: the temporary file can be on another disk
      await fs.promises.copyFile(file.path, target);
      await fs.promises.rm(file.path, { force: true });
    }

    async delete(key: string): Promise<void> {
      await fs.promises.rm(path.join(UPLOADS_DIR, key), { force: true });
    }

    path(key: string): string {
      return `${UPLOADS_URL}/${key.split('/').map(encodeURIComponent).join('/')}`;
    }
  }

  const provider = new LocalUploads();
  const maxSize = config.uploadMaxMb * 1024 * 1024;

  /**
   * The upload box checks type and size in the browser only; this checks them again
   * on the server, so nobody can store a script as an "image".
   */
  const checkFiles = (field: string, images: boolean) => async (request: ActionRequest): Promise<ActionRequest> => {
    if (request.method !== 'post' || !request.payload) return request;

    const files = ([] as (UploadedFile | undefined)[])
      .concat((flat.get(request.payload, `${field}File`) as UploadedFile | UploadedFile[] | undefined) || [])
      .filter((file): file is UploadedFile => Boolean(file?.path));
    for (const file of files) {
      if (images && !IMAGE_TYPES.includes(String(file.type))) {
        throw new ValidationError({ [`${field}File`]: { message: 'Choose a PNG, JPEG, GIF, WebP or AVIF image' } });
      }
      if (file.size > maxSize) {
        throw new ValidationError({ [`${field}File`]: { message: `The file is larger than ${config.uploadMaxMb} MB` } });
      }
    }
    return request;
  };

  return (field: string, { images = false } = {}): FeatureType => {
    const feature = uploadFeature({
      componentLoader,
      provider,
      properties: {
        key: field,
        file: `${field}File`,
        filePath: `${field}Url`,
        filesToDelete: `${field}ToDelete`,
      },
      // uploads/<resource>/<record id>/<field>-<file name>
      uploadPath: (record: { resource: { id(): string }; id(): string }, filename: string) =>
        `${record.resource.id()}/${record.id()}/${field}-${safeName(filename)}`,
      validation: {
        ...(images ? { mimeTypes: IMAGE_TYPES } : {}),
        maxSize,
      },
    });

    // The check runs before the upload feature takes the file out of the form
    return (admin, options) => {
      const result = feature(admin, options) as ResourceOptions;
      const actions = (result.actions ||= {}) as Record<string, { before?: unknown }>;
      for (const action of ['new', 'edit']) {
        const before = ([] as unknown[]).concat(actions[action]?.before || []);
        actions[action] = { ...actions[action], before: [checkFiles(field, images), ...before] };
      }
      return result;
    };
  };
}
