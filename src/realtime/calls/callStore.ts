import type { CallSessionPayload } from './types';

export type MobileCallPhase =
  | 'idle'
  | 'requesting-media'
  | 'incoming'
  | 'ringing'
  | 'connecting'
  | 'active'
  | 'ending'
  | 'ended'
  | 'error';

export interface MobileCallState {
  session: CallSessionPayload | null;
  phase: MobileCallPhase;
  muted: boolean;
  speaker: boolean;
  error: string | null;
}

const listeners = new Set<() => void>();

const initialState: MobileCallState = {
  session: null,
  phase: 'idle',
  muted: false,
  speaker: true,
  error: null,
};

let state: MobileCallState = initialState;

function emit() {
  listeners.forEach((listener) => listener());
}

export const callStore = {
  getState() {
    return state;
  },

  setState(next: MobileCallState | ((current: MobileCallState) => MobileCallState)) {
    state = typeof next === 'function' ? next(state) : next;
    emit();
  },

  patch(partial: Partial<MobileCallState>) {
    state = { ...state, ...partial };
    emit();
  },

  reset() {
    state = initialState;
    emit();
  },

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
