export function downloadBlob(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = fileName;
  link.rel = 'noopener';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Defer revoke so the browser has a tick to initiate the download.
  // Revoking synchronously right after click() can silently cancel the
  // download in Firefox/Safari, resulting in "successful response, nothing
  // happens" with no console error.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
