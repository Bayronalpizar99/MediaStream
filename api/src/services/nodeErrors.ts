export class NodeUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NodeUnavailableError';
  }
}
