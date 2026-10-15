import { handle } from '../lib/handler.js';

export const onRequest = async context => {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  // Không log JWT, secret hoặc toàn bộ request body.
  console.log(JSON.stringify({
    event: 'validate.start',
    requestId,
    method: context.request.method,
    path: new URL(context.request.url).pathname,
    contentType: context.request.headers.get('content-type'),
    hasJwtSecret: Boolean(context.env.SFMC_JWT_SECRET)
  }));

  try {
    const response = await handle(context, 'validate');

    let error;

    if (!response.ok) {
      const result = await response.clone().json().catch(() => null);
      error = result?.error;
    }

    console.log(JSON.stringify({
      event: 'validate.result',
      requestId,
      status: response.status,
      error,
      durationMs: Date.now() - startedAt
    }));

    return response;
  } catch (error) {
    console.error(JSON.stringify({
      event: 'validate.exception',
      requestId,
      errorType: error?.name ?? 'Error',
      durationMs: Date.now() - startedAt
    }));

    return Response.json({
      error: 'Validation handler failed',
      requestId
    }, { status: 500 });
  }
};
