/** Apply a bounded wait to outbound provider calls so a stalled service cannot
 * hold API requests and database resources indefinitely. Callers can still
 * supply their own signal when they need cancellation tied to a request. */
export function externalFetch(input: string | URL | Request, init: RequestInit = {}, timeoutMs = 15_000): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
  return fetch(input, { ...init, signal });
}
