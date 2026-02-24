import { HackerLoader } from '@/components/hacker-loader';

export default function WikiLoading() {
  return (
    <HackerLoader
      lines={[
        '> QUERYING ARTICLE RECORDS...',
        '> RESOLVING CATEGORIES...',
        '> APPLYING FILTERS...',
        '> RENDERING WIKI INDEX...',
      ]}
    />
  );
}
