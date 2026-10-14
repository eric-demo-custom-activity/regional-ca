import { jwtVerify } from 'jose';
import { parsePayload, PayloadError } from './payload.js';
const json = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control':'no-store'}});
export async function handle(context, action, fetcher = fetch) {
  const {request, env} = context;
  if (request.method !== 'POST') return json({error:'Method not allowed'},405);
  if (!env.SFMC_JWT_SECRET) return json({error:'SFMC_JWT_SECRET not configured'},503);
  let body;
  try {
    if (Number(request.headers.get('content-length')) > 1048576) return json({error:'Request too large'},413);
    const token = (await request.text()).trim();
    if (token.length > 1048576) return json({error:'Request too large'},413);
    ({payload:body} = await jwtVerify(token, new TextEncoder().encode(env.SFMC_JWT_SECRET), {algorithms:['HS256'],clockTolerance:5}));
  } catch { return json({error:'Invalid JWT'},401); }
  if (action !== 'execute') {
    // Lifecycle acknowledges authentication only; business data is checked at execute.
    return json({ok:true, action});
  }
  let payload;
  try { payload = parsePayload(body); }
  catch(error) {return json({error:error instanceof PayloadError ? error.message : 'Invalid payload'},400);}
  const mode = env.HUB_MODE ?? 'dry-run';
  if (mode === 'dry-run') {
    console.log(JSON.stringify({action, mode, correlationId:payload.correlationId,recipientCount:payload.recipients.length}));
    return json({ok:true,mode,sent:false,payload});
  }
  if (mode !== 'live') return json({error:'HUB_MODE must be dry-run or live'},503);
  let endpoint;
  try {endpoint = new URL(env.HUB_URL); if(endpoint.protocol !== 'https:') throw Error();}
  catch {return json({error:'Configure HTTPS HUB_URL'},503);}
  try {
    const headers = {'Content-Type':'application/json','Idempotency-Key':payload.idempotencyKey,'X-Correlation-ID':payload.correlationId};
    if (env.HUB_BEARER_TOKEN) headers.Authorization = `Bearer ${env.HUB_BEARER_TOKEN}`;
    const response = await fetcher(endpoint.toString(),{method:'POST',headers,body:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(8000)});
    // Do not expose provider response bodies or secrets.
    if (!response.ok) return json({error:'Hub rejected request',upstreamStatus:response.status},502);
    return json({ok:true,mode,sent:true,correlationId:payload.correlationId});
  } catch {return json({error:'Hub unavailable or timed out'},502);}
}
