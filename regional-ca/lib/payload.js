export class PayloadError extends Error {}
const fail = message => { throw new PayloadError(message); };
const text = (v, label) => {
  if (typeof v !== 'string' || !v.trim() || /\{\{|\}\}/.test(v)) fail(`${label}: required or unresolved binding`);
  return v.trim();
};
export function argumentsOf(body) {
  const args = body.inArguments ?? body.arguments?.execute?.inArguments;
  if (args === undefined) return body;
  if (!Array.isArray(args) || args.some(a => !a || typeof a !== 'object' || Array.isArray(a))) fail('inArguments must be an array of objects');
  return Object.assign({}, ...args);
}
export function parsePayload(body) {
  const a = argumentsOf(body);
  const source = a.payload ?? a;
  if (!source || typeof source !== 'object' || Array.isArray(source)) fail('payload must be an object');
  const templateKey = text(source.templateKey, 'templateKey');
  const correlationId = text(source.correlationId, 'correlationId');
  let recipients = source.recipients;
  if (!recipients) recipients = [{customerId: source.customerId, addresses: [{type: 'phone', value: source.phone}], params: source.params ?? {voucher: source.voucher}}];
  if (!Array.isArray(recipients) || recipients.length < 1 || recipients.length > 1000) fail('recipients: expected 1–1000');
  recipients = recipients.map((r, i) => {
    if (!r || typeof r !== 'object') fail(`recipient ${i}: invalid`);
    const customerId = text(r.customerId, 'customerId');
    if (!Array.isArray(r.addresses) || r.addresses.length < 1) fail('addresses required');
    const addresses = r.addresses.map(address => {
      if (address?.type !== 'phone') fail('Only phone addresses are supported');
      const value = text(address.value, 'phone');
      if (!/^\+[1-9]\d{7,14}$/.test(value)) fail('Phone must be E.164, e.g. +84900000001, without **');
      return {type: 'phone', value};
    });
    const params = r.params ?? {};
    if (!params || typeof params !== 'object' || Array.isArray(params)) fail('params must be an object');
    for (const [key, value] of Object.entries(params)) {
      if (!['string','number','boolean'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value))) fail(`params.${key}: expected scalar`);
      if (typeof value === 'string' && /\{\{|\}\}/.test(value)) fail(`params.${key}: unresolved binding`);
    }
    return {addresses, customerId, params};
  });
  let idempotencyKey = source.idempotencyKey;
  if (!idempotencyKey) {
    if (recipients.length !== 1) fail('Batch payload requires explicit idempotencyKey');
    const scope = text(source.idempotencyScope, 'idempotencyScope');
    // Scope must be changed for a new campaign/send occurrence; stable across retries.
    idempotencyKey = `${scope}:${recipients[0].customerId}`;
  }
  return {source: 'salesforce', idempotencyKey: text(idempotencyKey, 'idempotencyKey'), templateKey, correlationId, recipients};
}
