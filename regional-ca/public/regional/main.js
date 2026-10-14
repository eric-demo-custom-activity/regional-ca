(() => {
  const session = new Postmonger.Session();
  const ids = ['activityName','templateKey','correlationId','idempotencyScope','eventDefinitionKey','phoneField','customerIdField','voucherField','voucherValue'];
  let activity = {}, initialized = false;
  const get = id => document.getElementById(id).value.trim();
  function config() { return Object.fromEntries(ids.map(id => [id,get(id)])); }
  function args(c) {
    for(const field of ['templateKey','correlationId','idempotencyScope','eventDefinitionKey','phoneField','customerIdField']) if(!c[field]) throw Error(`Thiếu ${field}`);
    if(!/^[A-Za-z0-9_-]+$/.test(c.eventDefinitionKey)) throw Error('Event Definition Key không hợp lệ');
    for(const field of [c.phoneField,c.customerIdField,c.voucherField].filter(Boolean)) if(!/^[A-Za-z0-9_]+$/.test(field)) throw Error('Field DE chỉ hỗ trợ chữ, số và dấu _ trong bản này');
    const bind = field => `{{Event.${c.eventDefinitionKey}.${field}}}`;
    return {source:'salesforce',templateKey:c.templateKey,correlationId:c.correlationId,idempotencyScope:c.idempotencyScope,customerId:bind(c.customerIdField),phone:bind(c.phoneField),voucher:c.voucherField ? bind(c.voucherField) : c.voucherValue};
  }
  function preview() {
    document.getElementById('error').textContent = '';
    try {const a=args(config());document.getElementById('output').textContent=JSON.stringify([a],null,2);return a;}
    catch(e){document.getElementById('error').textContent=e.message;return null;}
  }
  session.on('initActivity', data => {
    activity = data || {};initialized = true;
    const saved=activity.configurationArguments?.notificationConfig;
    if(saved) for(const id of ids) if(saved[id] !== undefined) document.getElementById(id).value=saved[id];
    document.getElementById('status').textContent='Đã kết nối Journey Builder.';
    session.trigger('updateButton',{button:'next',text:'done',visible:true,enabled:true});
    preview();
  });
  session.on('requestedInteraction', interaction => {
    const key = interaction?.triggers?.[0]?.metaData?.eventDefinitionKey;
    if(key && !get('eventDefinitionKey')) document.getElementById('eventDefinitionKey').value=key;
    preview();
  });
  session.on('clickedNext', () => {
    if(!initialized) return;
    const input=preview();if(!input) return;
    activity.arguments ??= {};activity.arguments.execute ??= {};
    activity.arguments.execute.inArguments=[input];
    activity.configurationArguments ??= {};
    activity.configurationArguments.notificationConfig=config();
    activity.metaData ??= {};activity.metaData.isConfigured=true;
    activity.name=get('activityName') || 'Regional Notification Hub';
    session.trigger('updateActivity',activity);
  });
  document.getElementById('preview').addEventListener('click',preview);
  session.trigger('ready');session.trigger('requestInteraction');
})();
