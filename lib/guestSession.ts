const GUEST_ID_KEY = 'support_guest_id';
const GUEST_SESSION_KEY = 'support_guest_session_id';

const makeId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? `guest-${crypto.randomUUID()}`
    : `guest-${Math.random().toString(36).slice(2, 10)}`;

export function getGuestId(): string {
  const existing = localStorage.getItem(GUEST_ID_KEY);
  if (existing) return existing;
  const id = makeId();
  localStorage.setItem(GUEST_ID_KEY, id);
  return id;
}

export function getOrCreateSessionId(): string {
  const existing = localStorage.getItem(GUEST_SESSION_KEY);
  if (existing) return existing;
  const id = makeId();
  localStorage.setItem(GUEST_SESSION_KEY, id);
  return id;
}

export function newSession(): string {
  const id = makeId();
  localStorage.setItem(GUEST_SESSION_KEY, id);
  return id;
}
