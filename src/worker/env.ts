export interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  AI: {
    run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
  };
  ALLOWED_ORIGIN?: string;
}
