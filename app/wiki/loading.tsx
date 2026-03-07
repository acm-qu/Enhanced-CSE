import { HackerLoader } from '@/components/hacker-loader';

const LINES = [
  'Connecting to wiki index',
  'Loading article metadata',
  'Resolving filters and categories',
  'Rendering article collection'
];

export default function WikiLoading() {
  return <HackerLoader lines={LINES} />;
}
