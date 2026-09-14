'use client';

import { useField } from 'formik';
import { CldImage, CldUploadWidget } from 'next-cloudinary';
import { useCallback, useEffect, useRef } from 'react';

import { tenantUploadFolder } from '@core/media/folder';

import { FieldWrapper } from './FieldWrapper';

/**
 * Formik-bound Cloudinary uploader.
 *
 * Stores **public IDs**, not delivery URLs. A stored URL bakes in whatever
 * transformation was applied at upload time, so changing how images are
 * rendered later means rewriting every row; a public ID lets `CldImage` derive
 * the URL — and the format, quality and crop — at render time.
 *
 * Uploads go straight from the browser to Cloudinary, authorized by a signature
 * from `/api/stores/{slug}/uploads/signature`, which pins them to this store's
 * folder.
 */

type UploadResult = {
  info?: string | { public_id?: string };
};

export function ImageUploadField({
  name,
  label,
  storeSlug,
  max = 8,
  subtitle,
}: {
  name: string;
  label: string;
  storeSlug: string;
  max?: number;
  subtitle?: string;
}) {
  const [field, meta, helpers] = useField<string[]>(name);
  const images = field.value ?? [];

  /**
   * `CldUploadWidget` keeps the FIRST `onSuccess` it is handed and never picks
   * up a later one. A callback that closed over `images` therefore kept seeing
   * the array as it was on first render — so every upload wrote
   * `[...[], newId]` and the second picture silently replaced the first. Refs
   * keep the callback identity stable while still reading current values, which
   * is what makes a multi-file batch accumulate instead of overwrite.
   */
  const imagesRef = useRef(images);
  const setValueRef = useRef(helpers.setValue);

  // Synced in an effect rather than assigned during render: writing a ref while
  // rendering is not safe under concurrent React, and the compiler rejects it.
  // No dependency array, so both stay current after every render.
  useEffect(() => {
    imagesRef.current = images;
    setValueRef.current = helpers.setValue;
  });

  const addImage = useCallback(
    (result: UploadResult) => {
      const info = result.info;
      const publicId = typeof info === 'string' ? info : info?.public_id;
      if (!publicId) return;

      const current = imagesRef.current;
      // The widget fires once per file in a batch, so guard against a repeat.
      if (current.includes(publicId)) return;

      void setValueRef.current([...current, publicId].slice(0, max));
    },
    [max],
  );

  const removeImage = (publicId: string) => {
    // Deliberately not deleted from Cloudinary. Removing it here only detaches
    // it from the product; destroying the asset would break any order history
    // or cached page still pointing at it, and storage is far cheaper than that.
    void helpers.setValue(images.filter((id) => id !== publicId));
  };

  /** Promote an image to position 0, which is what the storefront uses as cover. */
  const makeCover = (publicId: string) => {
    void helpers.setValue([
      publicId,
      ...images.filter((id) => id !== publicId),
    ]);
  };

  return (
    <FieldWrapper
      name={name}
      label={label}
      subtitle={subtitle}
      error={meta.touched && typeof meta.error === 'string' ? meta.error : ''}
    >
      <div className='space-y-3'>
        {images.length > 0 ? (
          <ul className='flex flex-wrap gap-3'>
            {images.map((publicId, index) => (
              <li key={publicId} className='group/img relative'>
                <div className='relative size-24 overflow-hidden rounded-md border bg-gray-50'>
                  <CldImage
                    src={publicId}
                    alt=''
                    fill
                    sizes='96px'
                    className='object-cover'
                  />
                </div>
                {index === 0 ? (
                  <span className='absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] text-white'>
                    Cover
                  </span>
                ) : (
                  // Order is the only thing that decides the cover, so promoting
                  // one has to be doable without deleting and re-uploading the
                  // rest — which is what a merchant would otherwise have to do.
                  <button
                    type='button'
                    onClick={() => makeCover(publicId)}
                    className='absolute right-1 bottom-1 left-1 rounded bg-black/60 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover/img:opacity-100 focus:opacity-100'
                  >
                    Make cover
                  </button>
                )}
                <button
                  type='button'
                  onClick={() => removeImage(publicId)}
                  aria-label={`Remove image ${index + 1}`}
                  className='absolute -top-2 -right-2 size-6 rounded-full border bg-white text-sm shadow'
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {images.length < max ? (
          <CldUploadWidget
            signatureEndpoint={`/api/stores/${storeSlug}/uploads/signature`}
            options={{
              // Must match what the signature endpoint will sign, byte for
              // byte — hence the shared helper rather than a literal here.
              folder: tenantUploadFolder(storeSlug),
              multiple: true,
              maxFiles: max - images.length,
              sources: ['local', 'camera'],
              clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
              maxFileSize: 10_000_000,
            }}
            onSuccess={addImage}
          >
            {({ open }) => (
              <button
                type='button'
                onClick={() => open()}
                className='rounded-md border border-dashed px-4 py-3 text-sm text-gray-600 hover:bg-gray-50'
              >
                {images.length === 0 ? 'Upload images' : 'Add another image'}
              </button>
            )}
          </CldUploadWidget>
        ) : (
          <p className='text-xs text-gray-500'>
            Maximum of {max} images reached.
          </p>
        )}

        <p className='text-xs text-gray-500'>
          {images.length > 0
            ? `${images.length} of ${max} added. The first is the cover shown on the catalogue, cart and checkout; the rest appear on the product page.`
            : `Add up to ${max}. The first is the cover shown on the catalogue, cart and checkout; the rest appear on the product page.`}
        </p>
      </div>
    </FieldWrapper>
  );
}
