/**
 * Editor Command & History Abstraction for Undo / Redo
 */

export interface Command {
  name: string;
  execute: () => void;
  undo: () => void;
  redo: () => void;
}

export class HistoryManager {
  private past: Command[] = [];
  private future: Command[] = [];
  private maxDepth: number = 50;
  private onChangeCallbacks: Set<() => void> = new Set();

  constructor(maxDepth: number = 50) {
    this.maxDepth = maxDepth;
  }

  /**
   * Subscribe to history stack changes
   */
  public subscribe(callback: () => void): () => void {
    this.onChangeCallbacks.add(callback);
    return () => this.onChangeCallbacks.delete(callback);
  }

  private notify(): void {
    this.onChangeCallbacks.forEach((cb) => cb());
  }

  /**
   * Execute a command and record it in past history
   */
  public execute(command: Command): void {
    command.execute();
    this.past.push(command);
    if (this.past.length > this.maxDepth) {
      this.past.shift();
    }
    // Any new action clears the redo branch
    this.future = [];
    this.notify();
  }

  /**
   * Record a command that was already executed
   */
  public record(command: Command): void {
    this.past.push(command);
    if (this.past.length > this.maxDepth) {
      this.past.shift();
    }
    this.future = [];
    this.notify();
  }

  public undo(): boolean {
    const command = this.past.pop();
    if (!command) return false;

    command.undo();
    this.future.push(command);
    this.notify();
    return true;
  }

  public redo(): boolean {
    const command = this.future.pop();
    if (!command) return false;

    command.redo();
    this.past.push(command);
    this.notify();
    return true;
  }

  public get canUndo(): boolean {
    return this.past.length > 0;
  }

  public get canRedo(): boolean {
    return this.future.length > 0;
  }

  public clear(): void {
    this.past = [];
    this.future = [];
    this.notify();
  }
}
