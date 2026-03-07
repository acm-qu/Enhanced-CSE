import { HackerLoader } from '@/components/hacker-loader';

const LINES = [
  'Loading custom study plan',
  'Resolving prerequisite graph',
  'Preparing semester layout',
  'Rendering roadmap interface'
];

export default function CSStudyPlanLoading() {
  return <HackerLoader lines={LINES} />;
}
