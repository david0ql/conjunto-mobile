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
      } else {
        void this.syncPendingVotesForStoredAssemblies();
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
      const current = assemblyStore.getState();
      assemblyStore.patch({
        syncStatuses: {
          ...current.syncStatuses,
          [event.questionId]: 'synced',
        },
        verificationCode: event.token ? this.formatVerificationCode(event.token) : current.verificationCode,
        verificationAssemblyTitle: current.assembly?.title ?? current.verificationAssemblyTitle,
      });
    });

    this.socket.on('assembly:started', (payload: AssemblyPayload) => {
      void this.handleAssemblyStarted(payload);
    });

    this.socket.on('assembly:finished', (payload?: AssemblyPayload) => {
      void this.handleAssemblyFinished(payload);
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
      if (!assembly || assembly.id !== assemblyId) {
        await this.clearActiveAssemblyState();
        return;
      }

      await this.cacheAssembly(assembly);
      const activeQuestion = assembly.questions.find((q) => q.status === 'active') ?? null;

      assemblyStore.patch({ assembly, currentQuestion: activeQuestion });
    } catch {
      // Si falla el refresh, la asamblea en caché sigue siendo válida
    }
  }

  async loadActiveAssembly() {
    assemblyStore.patch({ phase: 'loading', error: null });
    try {
      const assembly = await getActiveAssembly();
      if (!assembly) {
        await this.syncPendingVotesForStoredAssemblies();
        await this.clearActiveAssemblyState();
        return;
      }

      await this.bootstrapAssembly(assembly);
    } catch {
      const cached = await this.getCachedAssembly(this.currentAssemblyId ?? assemblyStore.getState().assembly?.id ?? null);
      if (cached) {
        this.currentAssemblyId = cached.id;
        this.residentToken = (await AsyncStorage.getItem(TOKEN_KEY(cached.id))) ?? null;
        const activeQuestion = cached.questions.find((q) => q.status === 'active') ?? null;
        const verificationCode = this.residentToken ? this.formatVerificationCode(this.residentToken) : null;

        assemblyStore.patch({
          assembly: cached,
          currentQuestion: activeQuestion,
          stats: activeQuestion
            ? {
                assemblyId: cached.id,
                questionId: activeQuestion.id,
                ...activeQuestion.stats,
              }
            : null,
          phase: 'active',
          isOnline: false,
          verificationCode,
          verificationAssemblyTitle: verificationCode ? cached.title : null,
        });
      } else {
        await this.clearActiveAssemblyState();
        assemblyStore.patch({ isOnline: false });
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

      if (assemblyId !== this.currentAssemblyId) {
        return;
      }

      const newSyncStatuses: Record<string, VoteSyncStatus> = { ...assemblyStore.getState().syncStatuses };
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
    if (assemblyId !== this.currentAssemblyId) {
      return;
    }
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

  private async getCachedAssembly(assemblyId?: string | null): Promise<AssemblyPayload | null> {
    try {
      if (assemblyId) {
        const raw = await AsyncStorage.getItem(CACHE_KEY(assemblyId));
        return raw ? (JSON.parse(raw) as AssemblyPayload) : null;
      }

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
        verificationCode: null,
        verificationAssemblyTitle: null,
        error: null,
      });
    }
  }

  private async bootstrapAssembly(assembly: AssemblyPayload) {
    this.currentAssemblyId = assembly.id;
    await this.cacheAssembly(assembly);

    const tokenData = await this.loadResidentTokenData(assembly.id);
    this.residentToken = tokenData?.token ?? null;
    if (tokenData?.token) {
      await AsyncStorage.setItem(TOKEN_KEY(assembly.id), tokenData.token);
    }

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
      verificationCode: tokenData?.formatted ?? null,
      verificationAssemblyTitle: tokenData ? assembly.title : null,
      error: null,
    });

    if (this.socket?.connected) {
      this.socket.emit('assembly:join', { assemblyId: assembly.id });
      await this.syncPendingVotes(assembly.id);
    }
  }

  private async handleAssemblyFinished(payload?: AssemblyPayload) {
    const assemblyId = payload?.id ?? this.currentAssemblyId;
    if (assemblyId) {
      await this.syncPendingVotes(assemblyId);
    }
    await this.clearActiveAssemblyState();
  }

  private async clearActiveAssemblyState() {
    const current = assemblyStore.getState();
    const assemblyId = this.currentAssemblyId ?? current.assembly?.id ?? null;

    if (assemblyId) {
      await AsyncStorage.removeItem(CACHE_KEY(assemblyId));
    }

    this.currentAssemblyId = null;
    this.residentToken = null;

    assemblyStore.patch({
      assembly: null,
      currentQuestion: null,
      stats: null,
      myVotes: {},
      syncStatuses: {},
      rejectedReasons: {},
      verificationCode: current.verificationCode,
      verificationAssemblyTitle: current.verificationAssemblyTitle,
      phase: 'idle',
      error: null,
    });
  }

  private async syncPendingVotesForStoredAssemblies() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const voteKeys = keys.filter((key) => key.startsWith('assembly.offline_votes.'));

      for (const key of voteKeys) {
        const assemblyId = key.replace('assembly.offline_votes.', '');
        if (assemblyId) {
          await this.syncPendingVotes(assemblyId);
        }
      }
    } catch {
      // Keep waiting state intact; pending votes will retry later.
    }
  }

  private async loadResidentTokenData(assemblyId: string): Promise<{ token: string; formatted: string } | null> {
    try {
      const tokenData = await getMyToken(assemblyId);
      return tokenData;
    } catch {
      const cachedToken = await AsyncStorage.getItem(TOKEN_KEY(assemblyId));
      if (!cachedToken) {
        return null;
      }

      return {
        token: cachedToken,
        formatted: this.formatVerificationCode(cachedToken),
      };
    }
  }

  private formatVerificationCode(token: string) {
    return token.match(/.{1,3}/g)?.join('-') ?? token;
  }
}

export const assemblyService = new AssemblyService();
