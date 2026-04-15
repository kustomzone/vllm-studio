// CRITICAL
export const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export class AsyncLock {
  private queue: Array<() => void> = [];
  private locked = false;

  public async acquire(): Promise<() => void> {
    if (!this.locked) {
      this.locked = true;
      return () => this.release();
    }

    return new Promise((resolve) => {
      this.queue.push(() => {
        this.locked = true;
        resolve(() => this.release());
      });
    });
  }

  public async acquireWithTimeout(timeoutMs: number): Promise<(() => void) | null> {
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    });
    const acquirePromise = this.acquire().then((release) => release);
    const result = await Promise.race([timeoutPromise, acquirePromise]);
    return result;
  }

  public release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
      return;
    }
    this.locked = false;
  }
}

/** Bounded async queue with backpressure u2014 drops oldest items when full. */
export class AsyncQueue<TValue> {
  private readonly capacity: number;
  private readonly items: TValue[] = [];
  private readonly resolvers: Array<{
    resolve: (value: TValue) => void;
    reject: (error: Error) => void;
  }> = [];
  private closed = false;

  public constructor(capacity: number) {
    this.capacity = capacity;
  }

  public push(item: TValue): boolean {
    if (this.closed) {
      return false;
    }
    const resolver = this.resolvers.shift();
    if (resolver) {
      resolver.resolve(item);
      return true;
    }
    if (this.capacity <= 0) {
      return false;
    }
    if (this.items.length >= this.capacity) {
      this.items.shift();
    }
    this.items.push(item);
    return true;
  }

  public close(): void {
    this.closed = true;
    while (this.resolvers.length > 0) {
      const resolver = this.resolvers.shift();
      if (resolver) {
        resolver.reject(new Error("Queue closed"));
      }
    }
  }

  public async shift(signal?: AbortSignal): Promise<TValue> {
    if (this.items.length > 0) {
      return this.items.shift() as TValue;
    }

    return new Promise((resolve, reject) => {
      const onAbort = (): void => {
        signal?.removeEventListener("abort", onAbort);
        reject(new Error("Queue aborted"));
      };
      if (signal) {
        signal.addEventListener("abort", onAbort, { once: true });
      }
      this.resolvers.push({
        resolve: (value) => {
          signal?.removeEventListener("abort", onAbort);
          resolve(value);
        },
        reject: (error) => {
          signal?.removeEventListener("abort", onAbort);
          reject(error);
        },
      });
    });
  }
}
