import { ZaraState } from '../types/zara.types.ts';

export const TTS_COOLDOWN_MS = 850; // 800ms - 1000ms cooldown window

export interface LockoutState {
  isLockedOut: boolean;
  isCooldown: boolean;
  lockoutReason: 'speaking' | 'cooldown' | 'manual' | 'none';
  lastLockoutTimestamp: number;
}

/**
 * Checks whether the microphone & speech recognition should be active.
 * Enforces strict speaker lockout during SPEAKING and the 800ms cooldown window.
 */
export function canMicrophoneCapture(
  zaraState: ZaraState,
  isLockedOut: boolean,
  isCooldown: boolean
): boolean {
  if (isLockedOut || isCooldown) {
    return false;
  }
  if (zaraState === 'SPEAKING' || zaraState === 'PROCESSING' || zaraState === 'MUTED') {
    return false;
  }
  return zaraState === 'LISTENING' || zaraState === 'STANDBY';
}

/**
 * Checks whether wake-word evaluation should be allowed.
 * Strictly disabled during SPEAKING and cooldown periods.
 */
export function canEvaluateWakeWord(
  zaraState: ZaraState,
  isLockedOut: boolean,
  isCooldown: boolean
): boolean {
  if (isLockedOut || isCooldown) {
    return false;
  }
  if (zaraState === 'SPEAKING' || zaraState === 'MUTED') {
    return false;
  }
  return zaraState === 'STANDBY' || zaraState === 'LISTENING';
}

/**
 * Decides whether an incoming speech recognition transcript chunk should be processed or dropped as echo.
 */
export function shouldDropEchoTranscript(
  zaraState: ZaraState,
  isLockedOut: boolean,
  isCooldown: boolean
): boolean {
  // If ZARA is speaking or within the 800ms speaker cooldown, drop to prevent echo loop!
  if (isLockedOut || isCooldown || zaraState === 'SPEAKING') {
    return true;
  }
  return false;
}
