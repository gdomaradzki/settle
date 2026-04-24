import 'server-only';
import { put } from '@vercel/blob';

export async function storeInvoicePdf(
  pdfBase64: string,
  filename: string,
): Promise<string | null> {
  try {
    const buffer = Buffer.from(pdfBase64, 'base64');
    const blob = await put(filename, buffer, {
      access: 'public',
      addRandomSuffix: true,
      contentType: 'application/pdf',
    });
    return blob.url;
  } catch (err) {
    console.error('Blob upload failed, continuing without PDF persistence:', err);
    return null;
  }
}
