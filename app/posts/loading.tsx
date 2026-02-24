import { HackerLoader } from '@/components/hacker-loader';

export default function PostsLoading() {
  return (
    <HackerLoader
      lines={[
        '> FETCHING POST ARCHIVE...',
        '> LOADING CATEGORIES...',
        '> SORTING BY DATE...',
        '> RENDERING BLOG INDEX...',
      ]}
    />
  );
}
