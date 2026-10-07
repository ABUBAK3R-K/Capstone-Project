/**
 * A stand-in for a supabase-js query builder: every chained call (`.from`,
 * `.insert`, `.eq`, …) is recorded and returns the same builder, and awaiting
 * it resolves to the configured `{ data, error }`. Tests assert on `calls`
 * to check exactly what would have been sent to PostgREST.
 */
export type Call = [method: string, ...args: unknown[]];

export interface MockQuery {
  builder: unknown;
  calls: Call[];
}

export function mockQuery(result: { data?: unknown; error?: unknown }): MockQuery {
  const calls: Call[] = [];
  const settled = { data: result.data ?? null, error: result.error ?? null };

  const builder: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
            Promise.resolve(settled).then(resolve, reject);
        }
        return (...args: unknown[]) => {
          calls.push([String(prop), ...args]);
          return builder;
        };
      },
    },
  );

  return { builder, calls };
}

/** Arguments of the first recorded call to `method`. */
export function argsOf(calls: Call[], method: string): unknown[] | undefined {
  return calls.find(([name]) => name === method)?.slice(1);
}
