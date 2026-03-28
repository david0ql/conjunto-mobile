export interface QuestionStats {
  totalVoted: number;
  totalPending: number;
  yesCount: number;
  noCount: number;
  blankCount: number;
}

export interface AssemblyQuestion {
  id: string;
  assemblyId: string;
  text: string;
  order: number;
  status: 'pending' | 'active' | 'closed';
  activatedAt: string | null;
  closedAt: string | null;
  stats: QuestionStats;
}

export interface AssemblyPayload {
  id: string;
  publicId: string;
  title: string;
  description: string | null;
  scheduledDate: string;
  status: 'draft' | 'active' | 'finished';
  startedAt: string | null;
  finishedAt: string | null;
  questions: AssemblyQuestion[];
}

export interface VoteStatsPayload {
  assemblyId: string;
  questionId: string;
  totalVoted: number;
  totalPending: number;
  yesCount: number;
  noCount: number;
  blankCount: number;
}

export type VoteSyncStatus = 'saved_locally' | 'not_synced' | 'synced' | 'rejected';

export interface OfflineVote {
  localId: string;
  assemblyId: string;
  questionId: string;
  vote: 'yes' | 'no' | 'blank';
  votedAt: string;
  token: string;
  syncStatus: VoteSyncStatus;
  rejectedReason?: string;
}
