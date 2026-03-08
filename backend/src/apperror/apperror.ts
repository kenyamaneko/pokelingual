export class NotFoundError extends Error {
  constructor(message = "not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ExternalServiceError extends Error {
  service: string;
  cause: Error;

  constructor(service: string, err: Error) {
    super(`${service}: ${err.message}`);
    this.name = "ExternalServiceError";
    this.service = service;
    this.cause = err;
  }
}
