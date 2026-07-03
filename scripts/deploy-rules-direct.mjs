/**
 * deploy-rules-direct.mjs
 *
 * Despliega firestore.rules directo por la API de Firebase Rules,
 * sin pasar por el chequeo previo de "¿está habilitada la API de
 * Firestore?" que hace el Firebase CLI (ese chequeo necesita un
 * permiso de proyecto que la credencial del Admin SDK no tiene,
 * aunque sí pueda escribir reglas).
 */
import { readFileSync } from 'fs';
import { GoogleAuth } from 'google-auth-library';

const PROJECT_ID = 'base-de-datos-vista360';
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

const auth = new GoogleAuth({
  credentials: sa,
  scopes: ['https://www.googleapis.com/auth/firebase', 'https://www.googleapis.com/auth/cloud-platform'],
});
const client = await auth.getClient();
const { token } = await client.getAccessToken();

const rulesContent = readFileSync('firestore.rules', 'utf-8');

async function call(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`❌ ${method} ${url} → ${res.status}`);
    console.error(JSON.stringify(json, null, 2));
    process.exit(1);
  }
  return json;
}

console.log('1) Creando ruleset nuevo con el contenido de firestore.rules...');
const ruleset = await call(
  `https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}/rulesets`,
  'POST',
  { source: { files: [{ name: 'firestore.rules', content: rulesContent }] } }
);
console.log('   Ruleset creado:', ruleset.name);

console.log('2) Publicando el ruleset como la versión activa de Firestore...');
await call(
  `https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}/releases/cloud.firestore?updateMask=rulesetName`,
  'PATCH',
  { release: { name: `projects/${PROJECT_ID}/releases/cloud.firestore`, rulesetName: ruleset.name } }
);

console.log('✅ Reglas de Firestore desplegadas y activas.');
