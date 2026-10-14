import { handle } from '../lib/handler.js';
export const onRequest = context => handle(context, 'validate');
