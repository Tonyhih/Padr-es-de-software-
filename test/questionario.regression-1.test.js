'use strict';

// Regression: ISSUE-001 — com barra final (/questionario/) o formulário submetia para /questionario/questionario/responder (404)
// Found by /qa on 2026-11-22
// Report: .gstack/qa-reports/run-20261122T210130Z/qa-report-activity-provider-2026-11-22.md

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const app = require('../server');

let servidor;
let base;

before(async () => {
  await new Promise((resolve) => {
    servidor = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(() => {
  servidor.close();
});

/**
 * Abre a página do questionário e devolve o URL absoluto para onde o
 * formulário submete, resolvido contra o endereço da página como o browser faz.
 */
async function urlDeSubmissao(caminhoPagina) {
  const urlPagina = `${base}${caminhoPagina}`;
  const html = await (await fetch(urlPagina)).text();
  const encontrado = html.match(/fetch\((['"])(.*?)\1/);
  assert.ok(encontrado, 'a página tem de submeter as respostas com fetch');
  return new URL(encontrado[2], urlPagina);
}

describe('ISSUE-001: submissão do questionário', () => {
  for (const caminho of ['/questionario?id=abc', '/questionario/?id=abc']) {
    it(`a página ${caminho} submete para /questionario/responder`, async () => {
      const destino = await urlDeSubmissao(caminho);
      assert.equal(destino.pathname, '/questionario/responder');

      const res = await fetch(destino, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityID: 'abc', ids: ['p1'], respostas: ['Factory Method'] }),
      });
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { certas: 1, total: 1 });
    });
  }
});
