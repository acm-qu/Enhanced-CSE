export function formatDate(
  value: string | null,
  opts: { dateStyle?: 'medium' | 'long'; timeStyle?: 'short' } = {}
): string {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  const { dateStyle = 'medium', timeStyle } = opts;

  return new Intl.DateTimeFormat('en-US', {
    dateStyle,
    ...(timeStyle ? { timeStyle } : {})
  }).format(date);
}
