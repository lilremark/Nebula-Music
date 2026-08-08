export interface MediaArtworkEntry {
  src: string;
  sizes: string;
  type: string;
}

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

export const toDataUrlArtwork = async (
  entries: MediaArtworkEntry[],
): Promise<MediaArtworkEntry[]> => {
  const results = await Promise.all(
    entries.map(async (entry) => {
      try {
        const response = await fetch(entry.src, { credentials: 'same-origin' });
        if (!response.ok) return null;
        const blob = await response.blob();
        if (!blob.type.startsWith('image/')) return null;
        const dataUrl = await readBlobAsDataUrl(blob);
        return { src: dataUrl, sizes: entry.sizes, type: blob.type };
      } catch {
        return null;
      }
    }),
  );
  return results.filter((entry): entry is MediaArtworkEntry => entry !== null);
};
