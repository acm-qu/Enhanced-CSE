import { useCallback, useRef, useState } from 'react';

export type StreamStatus = 'idle' | 'connecting' | 'streaming' | 'completed' | 'error';

export interface StreamEvent {
  id: string;
  label: string;
  timestamp: number;
}

export interface StreamResult {
  answer: string;
  follow_ups: string[];
  sources: unknown[];
}

const FASTAPI_URL = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000';
const WS_BASE = FASTAPI_URL.replace(/^https?/i, (m) => (m === 'https' ? 'wss' : 'ws')).replace(/\/$/, '');
const GUEST_STREAM_URL = `${WS_BASE}/guest-stream`;

export function useSupportStream() {
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [streamedText, setStreamedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const cleanup = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  const stopStream = useCallback(() => {
    wsRef.current?.close();
  }, []);

  const resetStream = useCallback(() => {
    setStatus('idle');
    setEvents([]);
    setStreamedText('');
    setError(null);
    cleanup();
  }, [cleanup]);

  const startStream = useCallback(
    (
      payload: { question: string; inquiry_session_id: string; guest_id: string },
      handlers?: { onStatus?: (label: string) => void; onToken?: (text: string) => void }
    ) =>
      new Promise<StreamResult>((resolve, reject) => {
        let completed = false;
        setError(null);
        setEvents([]);
        setStreamedText('');
        setStatus('connecting');

        const ws = new WebSocket(GUEST_STREAM_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          setStatus('streaming');
          setEvents([{ id: 'init', label: 'Connecting to Suhail...', timestamp: Date.now() }]);
          ws.send(JSON.stringify({ ...payload, web_search: false }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data as string);

            if (data.type === 'status') {
              const label = (data.label as string) || 'Working...';
              setEvents((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, label, timestamp: Date.now() }]);
              handlers?.onStatus?.(label);
            } else if (data.type === 'token') {
              const text = (data.text as string) || '';
              setStreamedText((prev) => prev + text);
              handlers?.onToken?.(text);
            } else if (data.type === 'final') {
              completed = true;
              setStatus('completed');
              resolve({
                answer: (data.answer as string) || '',
                follow_ups: (data.follow_ups as string[]) || [],
                sources: (data.sources as unknown[]) || []
              });
              cleanup();
            } else if (data.type === 'error') {
              throw new Error((data.message as string) || 'Stream error');
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setStatus('error');
            setError(msg);
            reject(err);
            cleanup();
          }
        };

        ws.onerror = () => {
          const msg = 'Unable to connect to support service.';
          setStatus('error');
          setError(msg);
          reject(new Error(msg));
          cleanup();
        };

        ws.onclose = () => {
          if (!completed) {
            setError((prev) => prev || 'Connection closed.');
            reject(new Error('Stream closed'));
            cleanup();
          }
        };
      }),
    [cleanup]
  );

  return { status, events, streamedText, error, startStream, stopStream, resetStream };
}
