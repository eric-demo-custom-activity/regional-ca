import { SignJWT } from 'jose';
import { readFileSync, existsSync } from 'node:fs';
let secret=process.env.SFMC_JWT_SECRET;
if(!secret && existsSync('.dev.vars')) {
  const line=readFileSync('.dev.vars','utf8').split('\n').find(line=>line.startsWith('SFMC_JWT_SECRET='));
  secret=line?.slice('SFMC_JWT_SECRET='.length).trim().replace(/^['"]|['"]$/g,'');
}
if(!secret) throw Error('Set local SFMC_JWT_SECRET first');
const body=JSON.parse(readFileSync(process.argv[2] || 'examples/sfmc-execute.json','utf8'));
console.log(await new SignJWT(body).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('5m').sign(new TextEncoder().encode(secret)));
