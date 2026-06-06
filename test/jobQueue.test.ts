import test from "node:test";
import assert from "node:assert/strict";
import { JobQueue, QueueFullError } from "../src/jobQueue.js";

test("JobQueue runs jobs with concurrency limit", async () => {
  const queue = new JobQueue(1, 2);
  const order: string[] = [];

  const first = queue.enqueue(async () => {
    order.push("first-start");
    await new Promise((resolve) => setTimeout(resolve, 20));
    order.push("first-end");
    return "first";
  });
  const second = queue.enqueue(async () => {
    order.push("second");
    return "second";
  });

  assert.equal(await first, "first");
  assert.equal(await second, "second");
  assert.deepEqual(order, ["first-start", "first-end", "second"]);
});

test("JobQueue rejects when waiting queue is full", () => {
  const queue = new JobQueue(1, 0);

  assert.throws(
    () =>
      queue.enqueue(async () => {
        return "nope";
      }),
    QueueFullError
  );
});
