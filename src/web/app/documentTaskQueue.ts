type Task<T> = () => Promise<T>;

function createSerialExecutor() {
  let chain: Promise<unknown> = Promise.resolve();

  const execute = <T>(task: Task<T>): Promise<T> => {
    const result = chain.then(task);
    chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  return { execute };
}

const queues = new Map<string, ReturnType<typeof createSerialExecutor>>();

/** 同一 documentId 的 save / publish 串行执行，避免交错写草稿与发布。 */
export function getDocumentTaskQueue(documentId: string) {
  let q = queues.get(documentId);
  if (!q) {
    q = createSerialExecutor();
    queues.set(documentId, q);
  }
  return q;
}
