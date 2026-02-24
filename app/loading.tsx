import { HackerLoader } from '@/components/hacker-loader';

export default function Loading() {
  return (
    <HackerLoader
      lines={[
        '> INITIALIZING CSE PORTAL...',
        '> LOADING WIKI DATABASE...',
        '> BUILDING CONTENT INDEX...',
        '> READY',
      ]}
    />
  );
}
