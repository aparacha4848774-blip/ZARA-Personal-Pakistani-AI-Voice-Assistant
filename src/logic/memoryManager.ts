export interface MemoryRecord {
  id: string;
  category: 'preference' | 'fact' | 'instruction' | 'contact' | 'task';
  key: string;
  value: string;
  importance: 'high' | 'medium' | 'low';
  userApproved: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export function sortMemoriesByImportance(memories: MemoryRecord[]): MemoryRecord[] {
  const weight = { high: 3, medium: 2, low: 1 };
  return [...memories].sort((a, b) => {
    const diff = weight[b.importance] - weight[a.importance];
    if (diff !== 0) return diff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function formatMemoriesForPrompt(memories: MemoryRecord[]): string {
  const activeApproved = memories.filter((m) => m.isActive && m.userApproved);
  if (activeApproved.length === 0) {
    return 'No saved long-term memories yet.';
  }

  return activeApproved
    .map((m) => `- [${m.category.toUpperCase()}] ${m.key}: ${m.value}`)
    .join('\n');
}

export function categorizeNewInfo(
  key: string,
  value: string
): 'preference' | 'fact' | 'instruction' | 'contact' | 'task' {
  const lower = (key + ' ' + value).toLowerCase();
  if (lower.includes('phone') || lower.includes('email') || lower.includes('number') || lower.includes('contact')) {
    return 'contact';
  }
  if (lower.includes('todo') || lower.includes('task') || lower.includes('deadline') || lower.includes('karna hai')) {
    return 'task';
  }
  if (lower.includes('rule') || lower.includes('instruction') || lower.includes('hamesha') || lower.includes('never')) {
    return 'instruction';
  }
  if (lower.includes('like') || lower.includes('pasand') || lower.includes('tea') || lower.includes('chai') || lower.includes('favorite')) {
    return 'preference';
  }
  return 'fact';
}
