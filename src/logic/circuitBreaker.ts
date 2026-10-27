/**
 * Stateful Quota & Failure Circuit Breaker for AI Provider Integrations.
 * Implements standard Closed -> Open -> Half-Open lifecycle.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerDiagnostics {
  state: CircuitState;
  isExhausted: boolean;
  consecutiveFailures: number;
  cooldownUntil: number;
  remainingCooldownSeconds: number;
  lastFailureReason: string;
  lastFailureTime: string | null;
  probeInFlight: boolean;
}

export class StatefulQuotaCircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private cooldownUntil = 0;
  private consecutiveFailures = 0;
  private lastFailureReason = '';
  private lastFailureTime: string | null = null;
  private defaultCooldownSeconds: number;
  private probeInFlight = false;

  constructor(defaultCooldownSeconds = 900) {
    this.defaultCooldownSeconds = defaultCooldownSeconds;
  }

  /**
   * Determine whether an outgoing API call should be skipped because the circuit is OPEN.
   * If cooldown has expired while OPEN, transitions to HALF_OPEN to allow a test probe.
   */
  public shouldSkipApi(): boolean {
    const now = Date.now();

    if (this.state === 'OPEN') {
      if (now >= this.cooldownUntil) {
        // Cooldown expired; transition to HALF_OPEN for a single probe request
        this.state = 'HALF_OPEN';
        this.probeInFlight = false;
        return false;
      }
      return true;
    }

    if (this.state === 'HALF_OPEN') {
      // Allow only one probe at a time
      if (this.probeInFlight) {
        return true;
      }
      this.probeInFlight = true;
      return false;
    }

    return false; // CLOSED state: allow calls normally
  }

  /**
   * Called when a 429 RESOURCE_EXHAUSTED or quota error is detected from the provider.
   */
  public markQuotaExhausted(delaySeconds?: number, reason = 'Gemini Free Tier daily quota or rate limit reached') {
    const cooldown = Math.max(30, delaySeconds || this.defaultCooldownSeconds);
    this.state = 'OPEN';
    this.cooldownUntil = Date.now() + cooldown * 1000;
    this.consecutiveFailures += 1;
    this.lastFailureReason = reason;
    this.lastFailureTime = new Date().toISOString();
    this.probeInFlight = false;
  }

  /**
   * Called when an unexpected server error occurs (e.g. 503 high demand).
   */
  public recordFailure(reason: string) {
    this.consecutiveFailures += 1;
    this.lastFailureReason = reason;
    this.lastFailureTime = new Date().toISOString();

    if (this.state === 'HALF_OPEN') {
      // Probe failed, revert back to OPEN with a shorter retry cooldown
      this.state = 'OPEN';
      this.cooldownUntil = Date.now() + 60 * 1000; // 60s cooldown for transient failures
      this.probeInFlight = false;
    }
  }

  /**
   * Called upon successful response from the provider.
   * Resets the circuit breaker to CLOSED.
   */
  public recordSuccess() {
    this.state = 'CLOSED';
    this.cooldownUntil = 0;
    this.consecutiveFailures = 0;
    this.lastFailureReason = '';
    this.probeInFlight = false;
  }

  /**
   * Manually reset the circuit breaker (e.g. from UI reset button).
   */
  public reset() {
    this.recordSuccess();
  }

  /**
   * Returns current status and diagnostics without leaking secrets.
   */
  public getStatus(): CircuitBreakerDiagnostics {
    const now = Date.now();
    const remainingSeconds = this.state === 'OPEN' && this.cooldownUntil > now
      ? Math.round((this.cooldownUntil - now) / 1000)
      : 0;

    return {
      state: this.state,
      isExhausted: this.state === 'OPEN',
      consecutiveFailures: this.consecutiveFailures,
      cooldownUntil: this.cooldownUntil,
      remainingCooldownSeconds: remainingSeconds,
      lastFailureReason: this.lastFailureReason,
      lastFailureTime: this.lastFailureTime,
      probeInFlight: this.probeInFlight,
    };
  }
}

export const quotaCircuitBreaker = new StatefulQuotaCircuitBreaker();
