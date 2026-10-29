/**
 * Runs `worker` over `items` with a bounded number of in-flight promises.
 *
 * Results keep the input order and never reject: failures are returned as
 * `PromiseSettledResult`, mirroring `Promise.allSettled` so one broken file
 * cannot abort a scan.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  const concurrency = Math.max(1, Math.min(limit, items.length));
  let nextIndex = 0;

  const runners = Array.from({ length: concurrency }, async () => {
    for (;;) {
      const index = nextIndex++;
      if (index >= items.length) return;

      try {
        results[index] = {
          status: 'fulfilled',
          value: await worker(items[index], index),
        };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  });

  await Promise.all(runners);
  return results;
}
