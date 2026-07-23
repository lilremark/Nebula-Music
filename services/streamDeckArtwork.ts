import { STREAM_DECK_MAX_ARTWORK_LENGTH } from './streamDeckProtocol';

const MAX_ARTWORK_RESPONSE_BYTES = 8 * 1024 * 1024;
const TARGET_SIZE = 256;

const readBlobAsDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read artwork.'));
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Artwork did not produce a data URL.'));
    reader.readAsDataURL(blob);
  });

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to decode artwork.'));
    image.src = url;
  });

/**
 * Fetches authenticated cover art and returns pixels only. The source URL and
 * Subsonic authentication query parameters never cross the localhost bridge.
 */
export const createSanitizedArtwork = async (
  authenticatedUrl: string,
  signal?: AbortSignal,
): Promise<string | undefined> => {
  try {
    const response = await fetch(authenticatedUrl, {
      signal,
      credentials: 'same-origin',
      cache: 'force-cache',
    });
    if (!response.ok) return undefined;

    const declaredSize = Number(response.headers.get('content-length') || 0);
    if (declaredSize > MAX_ARTWORK_RESPONSE_BYTES) return undefined;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/') || blob.size > MAX_ARTWORK_RESPONSE_BYTES) return undefined;

    const sourceDataUrl = await readBlobAsDataUrl(blob);
    const image = await loadImage(sourceDataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = TARGET_SIZE;
    canvas.height = TARGET_SIZE;
    const context = canvas.getContext('2d');
    if (!context) return undefined;

    const scale = Math.max(TARGET_SIZE / image.naturalWidth, TARGET_SIZE / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    context.drawImage(
      image,
      (TARGET_SIZE - width) / 2,
      (TARGET_SIZE - height) / 2,
      width,
      height,
    );
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    return dataUrl.length <= STREAM_DECK_MAX_ARTWORK_LENGTH ? dataUrl : undefined;
  } catch {
    return undefined;
  }
};
