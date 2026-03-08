import { decode } from 'he';

export function decodeFetchedHtml(value: string | null | undefined): string {
  const raw = value ?? '';
  if (!raw) {
    return '';
  }  return decode(raw);
}
