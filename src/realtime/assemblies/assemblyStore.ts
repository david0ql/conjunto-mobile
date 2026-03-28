import type {
  AssemblyPayload,
  AssemblyQuestion,
  VoteStatsPayload,
  VoteSyncStatus,
} from './types';

export interface AssemblyVoteState {
  assembly: AssemblyPayload | null;
  currentQuestion: AssemblyQuestion | null;
  stats: VoteStatsPayload | null;
  myVotes: Record<string, 'yes' | 'no' | 'blank'>;
  syncStatuses: Record<string, VoteSyncStatus>;
  rejectedReasons: Record<string, string>;
  phase: 'idle' | 'loading' | 'active' | 'finished' | 'error';
  isOnline: boolean;
  error: string | null;
}

const listeners = new Set<() => void>();

const initialState: AssemblyVoteState = {
  assembly: null,
  currentQuestion: null,
  stats: null,
  myVotes: {},
  syncStatuses: {},
  rejectedReasons: {},
  phase: 'idle',
  isOnline: true,
  error: null,
};

let state: AssemblyVoteState = { ...initialState };

function emit() {
  listeners.forEach((l) => l());
}

export const assemblyStore = {
  getState() {
    return state;
  },

  setState(next: AssemblyVoteState | ((current: AssemblyVoteState) => AssemblyVoteState)) {
    state = typeof next === 'function' ? next(state) : next;
    emit();
  },

  patch(partial: Partial<AssemblyVoteState>) {
    state = { ...state, ...partial };
    emit();
  },

  reset() {
    state = { ...initialState };
    emit();
  },

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
