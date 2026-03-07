import { HackerLoader } from '@/components/hacker-loader';

const LINES = [
  'Connecting to posts archive',
  'Loading article metadata',
  'Resolving filters and archives',
  'Rendering post collection'
];

export default function PostsLoading() {
  return <HackerLoader lines={LINES} />;
}
