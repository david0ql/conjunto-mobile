import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, type Socket } from 'socket.io-client';
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import { REALTIME_URL, getActiveAssembly, getMyToken, syncVotes } from '../../services/api';
import { assemblyStore } from './assemblyStore';
import type {
  AssemblyPayload,
  AssemblyQuestion,
  OfflineVote,
  VoteStatsPayload,
  VoteSyncStatus,
} from './types';

const VOTES_KEY = (assemblyId: string) => `assembly.offline_votes.${assemblyId}`;
const CACHE_KEY = (assemblyId: string) => `assembly.cache.${assemblyId}`;
const TOKEN_KEY = (assemblyId: string) => `assembly.token.${assemblyId}`;

class AssemblyService {
  private socket: Socket | null = null;
  private activeToken: string | null = null;
  private residentToken: string | null = null;
  private currentAssemblyId: string | null = null;
  private appStateSubscription: NativeEventSubscription | null = null;

  start(token: string) {
    if (this.socket && this.activeToken === token) {
      return;
    }
    this.stop();
    this.activeToken = token;
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

    this.socket = io(REALTIME_URL, {
      auth: { token },
      autoConnect: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      assemblyStore.patch({ isOnline: true });
      if (this.currentAssemblyId) {
        this.socket?.emit('assembly:join', { assemblyId: this.currentAssemblyId });
        // Refresca estado completo desde REST por si cambió la pregunta mientras offline
        void this.refreshAssemblyState(this.currentAssemblyId);
        void this.syncPendingVotes(this.currentAssemblyId);
      }
    });

    this.socket.on('disconnect', () => {
      assemblyStore.patch({ isOnline: false });
    });

    this.socket.on('connect_error', () => {
      assemblyStore.patch({ isOnline: false });
    });

    this.socket.on('assembly:question_opened', (event: { assemblyId: string; question: AssemblyQuestion }) => {
      assemblyStore.patch({ currentQuestion: event.question, stats: null });
    });

    this.socket.on('assembly:question_closed', (event: { assemblyId: string; question: AssemblyQuestion }) => {
      const current = assemblyStore.getState();
      if (current.currentQuestion?.id === event.question.id) {
        assemblyStore.patch({ currentQuestion: event.question });
      }
    });

    this.socket.on('assembly:vote_received', (stats: VoteStatsPayload) => {
      assemblyStore.patch({ stats });
    });

    this.socket.on('assembly:vote_confirmed', (event: { questionId: string; vote: string; token: string }) => {
      assemblyStore.patch({
        syncStatuses: {
          ...assemblyStore.getState().syncStatuses,
          [event.questionId]: 'synced',
        },
      });
    });

    this.socket.on('assembly:started', (payload: AssemblyPayload) => {
      void this.handleAssemblyStarted(payload);
    });

    this.socket.on('assembly:finished', () => {
      assemblyStore.patch({ phase: 'finished' });
    });

    void this.loadActiveAssembly();
  }

  stop() {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
    this.activeToken = null;
    this.residentToken = null;
    this.currentAssemblyId = null;
    assemblyStore.reset();
  }

  private async refreshAssemblyState(assemblyId: string) {
    try {
      const assembly = await getActiveAssembly();
      if (!assembly || assembly.id !== assemblyId) return;

      await this.cacheAssembly(assembly);
      const activeQuestion = assembly.questions.find((q) => q.status === 'active') ?? null;

      assemblyStore.patch({ assembly, currentQuestion: activeQuestion });
    } catch {
      // Si falla el refresh, la asamblea en caché sigue siendo válida
    }
  }

  async loadActiveAssembly() {
    assemblyStore.patch({ phase: 'loading' });
    try {
      const assembly = await getActiveAssembly();
      if (!assembly) {
        const cached = await this.getCachedAssembly();
        if (cached) {
          assemblyStore.patch({ assembly: cached, phase: 'active' });
        } else {
          assemblyStore.patch({ phase: 'idle' });
        }
        return;
      }

      await this.bootstrapAssembly(assembly);
    } catch {
      const cached = await this.getCachedAssembly();
      if (cached) {
        assemblyStore.patch({ assembly: cached, phase: 'active', isOnline: false });
      } else {
        assemblyStore.patch({ phase: 'idle' });
      }
    }
  }

  async vote(questionId: string, assemblyId: string, voteValue: 'yes' | 'no' | 'blank') {
    const current = assemblyStore.getState();

    if (current.myVotes[questionId]) {
      return;
    }

    const votedAt = new Date().toISOString();
    const localId = `${assemblyId}_${questionId}_${Date.now()}`;
    const token = this.residentToken ?? (await AsyncStorage.getItem(TOKEN_KEY(assemblyId))) ?? '';

    const offlineVote: OfflineVote = {
      localId,
      assemblyId,
      questionId,
      vote: voteValue,
      votedAt,
      token,
      syncStatus: 'saved_locally',
    };

    await this.saveOfflineVote(assemblyId, offlineVote);

    assemblyStore.patch({
      myVotes: { ...current.myVotes, [questionId]: voteValue },
      syncStatuses: { ...current.syncStatuses, [questionId]: 'saved_locally' },
    });

    if (this.socket?.connected) {
      assemblyStore.patch({
        syncStatuses: { ...assemblyStore.getState().syncStatuses, [questionId]: 'not_synced' },
      });

      this.socket.emit('assembly:vote', {
        questionId,
        assemblyId,
        vote: voteValue,
        votedAt,
        token,
      });

      this.socket.once('assembly:vote_confirmed', () => {
        this.markVoteSynced(assemblyId, questionId);
      });

      this.socket.once('assembly:error', () => {
        assemblyStore.patch({
          syncStatuses: { ...assemblyStore.getState().syncStatuses, [questionId]: 'not_synced' },
        });
      });
    } else {
      assemblyStore.patch({
        syncStatuses: { ...assemblyStore.getState().syncStatuses, [questionId]: 'not_synced' },
      });
    }
  }

  async syncPendingVotes(assemblyId: string) {
    const pending = await this.getOfflineVotes(assemblyId);
    const toSync = pending.filter((v) => v.syncStatus === 'not_synced' || v.syncStatus === 'saved_locally');

    if (toSync.length === 0) return;

    try {
      const results = await syncVotes(assemblyId, toSync.map((v) => ({
        questionId: v.questionId,
        assemblyId: v.assemblyId,
        vote: v.vote,
        votedAt: v.votedAt,
        token: v.token,
      })));

      const updatedVotes = [...pending];

      for (const result of results) {
        const idx = updatedVotes.findIndex((v) => v.questionId === result.questionId);
        if (idx >= 0) {
          updatedVotes[idx] = {
            ...updatedVotes[idx],
            syncStatus: result.accepted ? 'synced' : 'rejected',
            rejectedReason: result.reason,
          };
        }
      }

      await AsyncStorage.setItem(VOTES_KEY(assemblyId), JSON.stringify(updatedVotes));

      const newSyncStatuses: Record<string, any> = { ...assemblyStore.getState().syncStatuses };
      const newRejectedReasons: Record<string, string> = { ...assemblyStore.getState().rejectedReasons };

      for (const result of results) {
        newSyncStatuses[result.questionId] = result.accepted ? 'synced' : 'rejected';
        if (result.reason && !result.accepted) {
          newRejectedReasons[result.questionId] = result.reason;
        }
      }

      assemblyStore.patch({ syncStatuses: newSyncStatuses, rejectedReasons: newRejectedReasons });
    } catch {
      // Network error — keep pending, will retry on next connect
    }
  }

  private async markVoteSynced(assemblyId: string, questionId: string) {
    const votes = await this.getOfflineVotes(assemblyId);
    const updated = votes.map((v) =>
      v.questionId === questionId ? { ...v, syncStatus: 'synced' as const } : v,
    );
    await AsyncStorage.setItem(VOTES_KEY(assemblyId), JSON.stringify(updated));
    assemblyStore.patch({
      syncStatuses: { ...assemblyStore.getState().syncStatuses, [questionId]: 'synced' },
    });
  }

  private async saveOfflineVote(assemblyId: string, vote: OfflineVote) {
    const existing = await this.getOfflineVotes(assemblyId);
    const filtered = existing.filter((v) => v.questionId !== vote.questionId);
    filtered.push(vote);
    await AsyncStorage.setItem(VOTES_KEY(assemblyId), JSON.stringify(filtered));
  }

  private async getOfflineVotes(assemblyId: string): Promise<OfflineVote[]> {
    try {
      const raw = await AsyncStorage.getItem(VOTES_KEY(assemblyId));
      return raw ? (JSON.parse(raw) as OfflineVote[]) : [];
    } catch {
      return [];
    }
  }

  private async cacheAssembly(assembly: AssemblyPayload) {
    await AsyncStorage.setItem(CACHE_KEY(assembly.id), JSON.stringify(assembly));
  }

  private async getCachedAssembly(): Promise<AssemblyPayload | null> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((k) => k.startsWith('assembly.cache.'));
      if (cacheKeys.length === 0) return null;
      const raw = await AsyncStorage.getItem(cacheKeys[0]);
      return raw ? (JSON.parse(raw) as AssemblyPayload) : null;
    } catch {
      return null;
    }
  }

  private handleAppStateChange = (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      void this.loadActiveAssembly();
    }
  };

  private async handleAssemblyStarted(assembly: AssemblyPayload) {
    try {
      await this.bootstrapAssembly(assembly);
    } catch {
      assemblyStore.patch({
        assembly,
        currentQuestion: assembly.questions.find((q) => q.status === 'active') ?? null,
        stats: null,
        phase: 'active',
        myVotes: {},
        syncStatuses: {},
        rejectedReasons: {},
        error: null,
      });
    }
  }

  private async bootstrapAssembly(assembly: AssemblyPayload) {
    this.currentAssemblyId = assembly.id;
    await this.cacheAssembly(assembly);

    const tokenData = await getMyToken(assembly.id);
    this.residentToken = tokenData.token;
    await AsyncStorage.setItem(TOKEN_KEY(assembly.id), tokenData.token);

    const activeQuestion = assembly.questions.find((q) => q.status === 'active') ?? null;
    const storedVotes = await this.getOfflineVotes(assembly.id);
    const myVotes: Record<string, 'yes' | 'no' | 'blank'> = {};
    const syncStatuses: Record<string, VoteSyncStatus> = {};
    const rejectedReasons: Record<string, string> = {};

    for (const vote of storedVotes) {
      myVotes[vote.questionId] = vote.vote;
      syncStatuses[vote.questionId] = vote.syncStatus;
      if (vote.rejectedReason) rejectedReasons[vote.questionId] = vote.rejectedReason;
    }

    assemblyStore.patch({
      assembly,
      currentQuestion: activeQuestion,
      stats: activeQuestion
        ? {
            assemblyId: assembly.id,
            questionId: activeQuestion.id,
            ...activeQuestion.stats,
          }
        : null,
      phase: 'active',
      myVotes,
      syncStatuses,
      rejectedReasons,
      error: null,
    });

    if (this.socket?.connected) {
      this.socket.emit('assembly:join', { assemblyId: assembly.id });
      await this.syncPendingVotes(assembly.id);
    }
  }
}

export const assemblyService = new AssemblyService();
