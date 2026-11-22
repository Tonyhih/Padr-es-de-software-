'use strict';

// Testes dos endpoints do Activity Provider.
// A aplicação é arrancada numa porta livre e os pedidos são feitos com fetch.

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const app = require('../server');

let servidor;
let base;

before(async () => {
  process.env.BASE_URL = 'https://exemplo.onrender.com/';
  await new Promise((resolve) => {
    servidor = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(() => {
  servidor.close();
  delete process.env.BASE_URL;
});

/** Faz um pedido POST com corpo JSON. */
function postJson(caminho, corpo) {
  return fetch(base + caminho, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
  });
}

describe('GET /config', () => {
  it('devolve HTML com os campos titulo e numPerguntas', async () => {
    const res = await fetch(`${base}/config`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    const html = await res.text();
    assert.match(html, /id="titulo"/);
    assert.match(html, /id="numPerguntas"/);
    assert.match(html, /type="number"/);
  });
});

describe('GET /json-params', () => {
  it('devolve os parâmetros de configuração', async () => {
    const res = await fetch(`${base}/json-params`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), [
      { name: 'titulo', type: 'text/plain' },
      { name: 'numPerguntas', type: 'integer' },
    ]);
  });
});

describe('GET /deploy', () => {
  it('devolve o URL da atividade a partir de BASE_URL', async () => {
    const res = await fetch(`${base}/deploy?activityID=abc123`);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), 'https://exemplo.onrender.com/questionario?id=abc123');
  });

  it('responde 400 sem activityID', async () => {
    const res = await fetch(`${base}/deploy`);
    assert.equal(res.status, 400);
  });
});

describe('GET /analytics-list', () => {
  it('devolve as analytics disponíveis', async () => {
    const res = await fetch(`${base}/analytics-list`);
    assert.deepEqual(await res.json(), {
      qualAnalytics: [{ name: 'Relatório do aluno', type: 'URL' }],
      quantAnalytics: [
        { name: 'Respostas certas', type: 'integer' },
        { name: 'Tempo total (s)', type: 'integer' },
      ],
    });
  });
});

describe('POST /analytics', () => {
  it('devolve uma lista de alunos de exemplo', async () => {
    const res = await postJson('/analytics', { activityID: 'abc123' });
    assert.equal(res.status, 200);
    const alunos = await res.json();
    assert.ok(Array.isArray(alunos) && alunos.length > 0);
    for (const aluno of alunos) {
      assert.ok('inveniraStdID' in aluno);
      assert.deepEqual(
        aluno.quantAnalytics.map((a) => a.name),
        ['Respostas certas', 'Tempo total (s)'],
      );
      assert.equal(aluno.qualAnalytics[0].name, 'Relatório do aluno');
      assert.match(aluno.qualAnalytics[0].value, /^https:\/\/exemplo\.onrender\.com\//);
    }
  });

  it('responde 400 sem activityID', async () => {
    const res = await postJson('/analytics', {});
    assert.equal(res.status, 400);
  });

  it('responde 400 com JSON mal formado', async () => {
    const res = await postJson('/analytics', '{ isto não é JSON');
    assert.equal(res.status, 400);
  });
});

describe('POST /questionario/corrigir', () => {
  const perguntas = [
    {
      tipo: 'multipla',
      enunciado: 'Que padrão delega a criação nas subclasses?',
      correta: 'Factory Method',
      opcoes: ['Singleton', 'Factory Method', 'Observer'],
    },
    { tipo: 'vf', enunciado: 'O Singleton é um padrão de criação.', correta: true },
    { tipo: 'curta', enunciado: 'Padrão que notifica observadores?', correta: 'Observer' },
  ];

  it('conta as respostas certas', async () => {
    const res = await postJson('/questionario/corrigir', {
      perguntas,
      respostas: ['Factory Method', false, ' observer '],
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { certas: 2, total: 3 });
  });

  it('responde 400 para um tipo desconhecido', async () => {
    const res = await postJson('/questionario/corrigir', {
      perguntas: [{ tipo: 'ensaio', enunciado: 'X', correta: 'Y' }],
      respostas: ['Y'],
    });
    assert.equal(res.status, 400);
    assert.match((await res.json()).erro, /desconhecido/);
  });

  it('responde 400 quando faltam perguntas ou respostas', async () => {
    assert.equal((await postJson('/questionario/corrigir', {})).status, 400);
    assert.equal((await postJson('/questionario/corrigir', { perguntas })).status, 400);
    assert.equal(
      (await postJson('/questionario/corrigir', { perguntas, respostas: ['Factory Method'] })).status,
      400,
    );
  });

  it('responde 400 para dados de pergunta inválidos', async () => {
    const res = await postJson('/questionario/corrigir', {
      perguntas: [null, { tipo: 'vf', enunciado: '', correta: true }],
      respostas: [true, true],
    });
    assert.equal(res.status, 400);
  });
});

describe('Endereço inexistente', () => {
  it('responde 404', async () => {
    const res = await fetch(`${base}/nao-existe`);
    assert.equal(res.status, 404);
  });
});
