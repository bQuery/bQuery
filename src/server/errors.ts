/**
 * Structured HTTP errors for the server module.
 *
 * @module bquery/server
 */

export class ServerHttpError extends Error {
  expose: boolean;
  status: number;

  constructor(status: number, message: string, options: { expose?: boolean } = {}) {
    super(message);
    this.name = 'ServerHttpError';
    this.status = status;
    this.expose = options.expose ?? status < 500;
  }
}

export const badRequest = (message = 'Bad Request'): ServerHttpError =>
  new ServerHttpError(400, message);

export const unauthorized = (message = 'Unauthorized'): ServerHttpError =>
  new ServerHttpError(401, message);

export const forbidden = (message = 'Forbidden'): ServerHttpError =>
  new ServerHttpError(403, message);

export const notFound = (message = 'Not Found'): ServerHttpError =>
  new ServerHttpError(404, message);

export const conflict = (message = 'Conflict'): ServerHttpError =>
  new ServerHttpError(409, message);
