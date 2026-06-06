export class QueueFullError extends Error {
  constructor() {
    super("job queue is full");
    this.name = "QueueFullError";
  }
}

interface PendingJob<T> {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

export class JobQueue {
  private activeCount = 0;
  private readonly pending: PendingJob<unknown>[] = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueueSize: number
  ) {}

  get active(): number {
    return this.activeCount;
  }

  get waiting(): number {
    return this.pending.length;
  }

  enqueue<T>(run: () => Promise<T>): Promise<T> {
    if (this.pending.length >= this.maxQueueSize) {
      throw new QueueFullError();
    }

    return new Promise<T>((resolve, reject) => {
      this.pending.push({
        run: run as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject
      });
      this.drain();
    });
  }

  private drain(): void {
    while (this.activeCount < this.maxConcurrent && this.pending.length > 0) {
      const job = this.pending.shift();
      if (!job) {
        return;
      }

      this.activeCount += 1;
      job
        .run()
        .then(job.resolve, job.reject)
        .finally(() => {
          this.activeCount -= 1;
          this.drain();
        });
    }
  }
}
