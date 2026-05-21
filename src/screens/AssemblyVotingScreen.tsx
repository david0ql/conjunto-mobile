import React, { useSyncExternalStore } from 'react';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NavigationComponentProps } from 'react-native-navigation';
import { NoirScreen, NoirTopBar } from '../components/NoirUI';
import { noirTheme } from '../design/theme';
import { assemblyStore } from '../realtime/assemblies/assemblyStore';
import { assemblyService } from '../realtime/assemblies/assemblyService';
import type { VoteSyncStatus } from '../realtime/assemblies/types';

const VOTE_LABELS = {
  yes: 'Sí',
  no: 'No',
  blank: 'Blanco',
} as const;

const SYNC_BADGE: Record<VoteSyncStatus, { label: string; bg: string; color: string }> = {
  saved_locally: { label: 'Guardado', bg: '#78350f', color: '#fef3c7' },
  not_synced: { label: 'No sincronizado aún', bg: '#7c2d12', color: '#fed7aa' },
  synced: { label: 'Respuesta sincronizada ✓', bg: '#14532d', color: '#bbf7d0' },
  rejected: { label: 'Voto rechazado', bg: '#7f1d1d', color: '#fecaca' },
};

const VOTE_COLORS = {
  yes: { bg: '#14532d', border: '#16a34a', label: '#bbf7d0' },
  no: { bg: '#7f1d1d', border: '#dc2626', label: '#fecaca' },
  blank: { bg: '#1c1917', border: '#78716c', label: '#d6d3d1' },
};

function VerificationCodeCard({
  code,
  assemblyTitle,
  title,
}: {
  code: string;
  assemblyTitle: string | null;
  title: string;
}) {
  return (
    <View style={styles.verificationCard}>
      <Text style={styles.verificationLabel}>{title}</Text>
      <Text style={styles.verificationCode}>{code}</Text>
      <Text style={styles.verificationHelp}>
        {assemblyTitle ? `${assemblyTitle}. ` : ''}
        Úsalo en la web pública para verificar que tu voto quedó registrado correctamente.
      </Text>
    </View>
  );
}

export function AssemblyVotingScreen({ componentId: _componentId }: NavigationComponentProps) {
  const state = useSyncExternalStore(assemblyStore.subscribe, assemblyStore.getState);

  const handleVote = (vote: 'yes' | 'no' | 'blank') => {
    const q = state.currentQuestion;
    const assembly = state.assembly;
    if (!q || !assembly) return;
    if (state.myVotes[q.id]) return;
    void assemblyService.vote(q.id, assembly.id, vote);
  };

  if (state.phase === 'loading') {
    return (
      <NoirScreen scroll={false}>
        <NoirTopBar title="Asamblea" />
        <View style={styles.centered}>
          <ActivityIndicator color={noirTheme.primary} size="large" />
          <Text style={styles.subtitle}>Cargando asamblea...</Text>
        </View>
      </NoirScreen>
    );
  }

  if (state.phase === 'idle' || state.phase === 'finished' || !state.assembly) {
    return (
      <NoirScreen scroll={false}>
        <NoirTopBar title="Asamblea" />
        <View style={styles.waitingScreen}>
          <View style={styles.waitingHero}>
            <MaterialIcons name="how-to-vote" size={64} color={noirTheme.secondary} style={styles.icon} />
            <Text style={styles.title}>Sin asamblea activa</Text>
            <Text style={styles.subtitle}>
              Cuando el administrador inicie una asamblea aparecerá aquí.
            </Text>
          </View>

          {state.verificationCode && (
            <VerificationCodeCard
              code={state.verificationCode}
              assemblyTitle={state.verificationAssemblyTitle}
              title="Último código de verificación"
            />
          )}
        </View>
      </NoirScreen>
    );
  }

  const question = state.currentQuestion;
  const myVote = question ? state.myVotes[question.id] : null;
  const syncStatus = question ? state.syncStatuses[question.id] : null;
  const rejectedReason = question ? state.rejectedReasons[question.id] : null;
  const badge = syncStatus ? SYNC_BADGE[syncStatus] : null;

  return (
    <NoirScreen scroll={false}>
      <NoirTopBar title="Asamblea" />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.assemblyTitle}>{state.assembly.title}</Text>
          <View style={[styles.onlineDot, { backgroundColor: state.isOnline ? '#22c55e' : '#ef4444' }]} />
        </View>

        {state.verificationCode && (
          <VerificationCodeCard
            code={state.verificationCode}
            assemblyTitle={state.verificationAssemblyTitle}
            title="Código de verificación"
          />
        )}

        {!question && (
          <View style={styles.centered}>
            <Text style={styles.waiting}>Esperando siguiente pregunta...</Text>
          </View>
        )}

        {question && (
          <View style={styles.questionArea}>
            <Text style={styles.questionLabel}>Pregunta</Text>
            <Text style={styles.questionText}>{question.text}</Text>

            {/* Sync badge */}
            {badge && (
              <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                {syncStatus === 'rejected' && rejectedReason && (
                  <Text style={[styles.badgeReason, { color: badge.color }]}>
                    {rejectedReason === 'voted_after_question_closed'
                      ? 'Votaste después del cierre de la pregunta'
                      : rejectedReason}
                  </Text>
                )}
              </View>
            )}

            {/* Vote buttons */}
            {!myVote ? (
              <View style={styles.voteButtons}>
                {(['yes', 'no', 'blank'] as const).map((option) => {
                  const colors = VOTE_COLORS[option];
                  return (
                    <Pressable
                      key={option}
                      style={[
                        styles.voteBtn,
                        { backgroundColor: colors.bg, borderColor: colors.border },
                      ]}
                      onPress={() => handleVote(option)}
                    >
                      <Text style={[styles.voteBtnLabel, { color: colors.label }]}>
                        {VOTE_LABELS[option]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={styles.votedContainer}>
                <Text style={styles.votedLabel}>Tu voto:</Text>
                <View
                  style={[
                    styles.votedBadge,
                    { backgroundColor: VOTE_COLORS[myVote].bg, borderColor: VOTE_COLORS[myVote].border },
                  ]}
                >
                  <Text style={[styles.votedText, { color: VOTE_COLORS[myVote].label }]}>
                    {VOTE_LABELS[myVote]}
                  </Text>
                </View>
              </View>
            )}

            {/* Live stats */}
            {state.stats && state.stats.questionId === question.id && (
              <View style={styles.statsArea}>
                <Text style={styles.statsTitle}>Resultados en vivo</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: '#4ade80' }]}>{state.stats.yesCount}</Text>
                    <Text style={styles.statLabel}>Sí</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: '#f87171' }]}>{state.stats.noCount}</Text>
                    <Text style={styles.statLabel}>No</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: '#a8a29e' }]}>{state.stats.blankCount}</Text>
                    <Text style={styles.statLabel}>Blanco</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: noirTheme.secondary }]}>{state.stats.totalPending}</Text>
                    <Text style={styles.statLabel}>Pendientes</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    </NoirScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  waitingScreen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 24,
  },
  waitingHero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: noirTheme.ink,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: noirTheme.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 10,
  },
  assemblyTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: noirTheme.ink,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  verificationCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: noirTheme.surfaceLow,
    padding: 16,
    gap: 8,
  },
  verificationLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: noirTheme.secondary,
    textTransform: 'uppercase',
  },
  verificationCode: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2.4,
    color: noirTheme.primary,
  },
  verificationHelp: {
    fontSize: 13,
    lineHeight: 19,
    color: noirTheme.secondary,
  },
  waiting: {
    fontSize: 15,
    color: noirTheme.secondary,
    textAlign: 'center',
  },
  questionArea: {
    flex: 1,
    gap: 16,
  },
  questionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: noirTheme.secondary,
    textTransform: 'uppercase',
  },
  questionText: {
    fontSize: 20,
    fontWeight: '700',
    color: noirTheme.ink,
    lineHeight: 28,
  },
  badge: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  badgeReason: {
    fontSize: 11,
    marginTop: 2,
    opacity: 0.85,
  },
  voteButtons: {
    gap: 12,
    marginTop: 8,
  },
  voteBtn: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 18,
    alignItems: 'center',
  },
  voteBtnLabel: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  votedContainer: {
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  votedLabel: {
    fontSize: 13,
    color: noirTheme.secondary,
    fontWeight: '500',
  },
  votedBadge: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  votedText: {
    fontSize: 18,
    fontWeight: '700',
  },
  statsArea: {
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statsTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: noirTheme.secondary,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    color: noirTheme.secondary,
  },
});
