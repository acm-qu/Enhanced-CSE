import { HackerLoader } from '@/components/hacker-loader';

const LINES = [
  'Booting Enhanced CSE portal',
  'Syncing homepage modules',
  'Preparing navigation surface',
  'Rendering content indecies'
];

export default function Loading() {
  return <HackerLoader lines={LINES} />;
}
