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

describe('GET /questionario', () => {
  it('mostra as perguntas sem as respostas corretas', async () => {
    const res = await fetch(`${base}/questionario?id=abc123&numPerguntas=3&titulo=Teste%20%3Cb%3E`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    const html = await res.text();
    assert.equal((html.match(/<fieldset/g) || []).length, 3);
    assert.match(html, /Teste &lt;b&gt;/); // o título é escapado
    assert.doesNotMatch(html, /"correta"/);
    assert.match(html, /"activityID":"abc123"/);
  });

  it('usa 5 perguntas por omissão e não passa do tamanho do banco', async () => {
    const html5 = await (await fetch(`${base}/questionario?id=a`)).text();
    assert.equal((html5.match(/<fieldset/g) || []).length, 5);
    const htmlMax = await (await fetch(`${base}/questionario?id=a&numPerguntas=999`)).text();
    assert.equal((htmlMax.match(/<fieldset/g) || []).length, 10);
  });

  it('responde 400 sem id ou com numPerguntas inválido', async () => {
    assert.equal((await fetch(`${base}/questionario`)).status, 400);
    assert.equal((await fetch(`${base}/questionario?id=a&numPerguntas=0`)).status, 400);
    assert.equal((await fetch(`${base}/questionario?id=a&numPerguntas=dois`)).status, 400);
  });
});

describe('POST /questionario/responder', () => {
  it('corrige as respostas com as perguntas do banco', async () => {
    const res = await postJson('/questionario/responder', {
      activityID: 'abc123',
      ids: ['p1', 'p2', 'p3', 'p5'],
      respostas: ['Factory Method', 'verdadeiro', 'observer', 'verdadeiro'],
      tempo: 42,
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { certas: 3, total: 4 });
  });

  it('conta perguntas sem resposta como erradas', async () => {
    const res = await postJson('/questionario/responder', {
      activityID: 'abc123',
      ids: ['p1', 'p2'],
      respostas: [null, null],
    });
    assert.deepEqual(await res.json(), { certas: 0, total: 2 });
  });

  it('responde 400 para pedidos inválidos', async () => {
    const pedidos = [
      { ids: ['p1'], respostas: ['x'] },
      { activityID: 'a', ids: [], respostas: [] },
      { activityID: 'a', ids: ['p1'], respostas: [] },
      { activityID: 'a', ids: ['p999'], respostas: ['x'] },
    ];
    for (const pedido of pedidos) {
      assert.equal((await postJson('/questionario/responder', pedido)).status, 400);
    }
  });
});

describe('GET /relatorio', () => {
  it('mostra o relatório de um aluno de exemplo', async () => {
    const res = await fetch(`${base}/relatorio?id=abc123&aluno=1001`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /1001/);
    assert.match(html, /4 de 5/);
  });

  it('os links das analytics abrem o relatório', async () => {
    const alunos = await (await postJson('/analytics', { activityID: 'abc 123' })).json();
    for (const aluno of alunos) {
      const url = new URL(aluno.qualAnalytics[0].value);
      const res = await fetch(base + url.pathname + url.search);
      assert.equal(res.status, 200);
    }
  });

  it('responde 400 sem parâmetros e 404 para um aluno desconhecido', async () => {
    assert.equal((await fetch(`${base}/relatorio?id=abc123`)).status, 400);
    assert.equal((await fetch(`${base}/relatorio?id=abc123&aluno=9999`)).status, 404);
  });
});
