import { decode } from 'he';

export function decodeFetchedHtml(value: string | null | undefined): string {
  const raw = value ?? '';
  if (!raw) {
    return '';
  }
  console.log('Decoding fetched HTML:', raw);
  return decode(raw);
}
