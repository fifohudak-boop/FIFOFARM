import type { Tab } from './App';
import type { IconName } from './components/Icon';

export interface NavItem {
  id: Tab;
  label: string;
  icon: IconName;
  also?: Tab[]; // other pages that light this item up (the two library entry points share one page)
}

// The pipeline, in the order the work happens: find a reel → turn it into a prompt → make it with
// the model → cut it → strip its hidden data → post it. The sidebar draws these on one rail.
export const PIPELINE: NavItem[] = [
  { id: 'reels', label: 'Reel Finder', icon: 'search' },
  { id: 'prompt', label: 'Prompt Making', icon: 'prompt' },
  { id: 'studio', label: 'AI Studio', icon: 'sparkles' },
  { id: 'edit', label: 'Editing', icon: 'scissors' },
  { id: 'meta', label: 'Metadata', icon: 'shield' },
  { id: 'post', label: 'Post', icon: 'send' },
];

// What comes out of the pipeline, to look back on.
export const REVIEW: NavItem[] = [
  { id: 'reels-library', label: 'Library', icon: 'folder', also: ['studio-library'] },
  { id: 'history', label: 'History', icon: 'clock' },
  { id: 'analytics', label: 'Analytics', icon: 'chart' },
  { id: 'studio-spending', label: 'Spending', icon: 'card' },
];

export const SETUP: NavItem[] = [
  { id: 'accounts', label: 'Accounts', icon: 'users' },
  { id: 'settings', label: 'Settings', icon: 'sliders' },
];

const EVERY = [...PIPELINE, ...REVIEW, ...SETUP];

export const ALL_TABS: Tab[] = EVERY.flatMap((item) => [item.id, ...(item.also ?? [])]);

export function navItemOf(tab: Tab): NavItem | undefined {
  return EVERY.find((item) => item.id === tab || item.also?.includes(tab));
}
