type LogLevel = 'info' | 'error';

export function log(level: LogLevel, event: string, payload: Record<string, unknown>): void {
  const record = {
    level,
    event,
    time: new Date().toISOString(),
    ...payload
  };

  const serialized = JSON.stringify(record);
  if (level === 'error') {
    console.error(serialized);
    return;
  }

  console.info(serialized);
}
