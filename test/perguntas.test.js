'use strict';

// Testes do padrão Factory Method (perguntas.js).

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  ErroPergunta,
  Pergunta,
  EscolhaMultipla,
  VerdadeiroFalso,
  RespostaCurta,
  CriadorPergunta,
  CriadorEscolhaMultipla,
  CriadorVerdadeiroFalso,
  CriadorRespostaCurta,
  obterCriador,
} = require('../perguntas');

describe('obterCriador', () => {
  it('devolve o criador certo para cada tipo', () => {
    assert.ok(obterCriador('multipla') instanceof CriadorEscolhaMultipla);
    assert.ok(obterCriador('vf') instanceof CriadorVerdadeiroFalso);
    assert.ok(obterCriador('curta') instanceof CriadorRespostaCurta);
  });

  it('todos os criadores são subclasses de CriadorPergunta', () => {
    for (const tipo of ['multipla', 'vf', 'curta']) {
      assert.ok(obterCriador(tipo) instanceof CriadorPergunta);
    }
  });

  it('lança um erro para um tipo desconhecido', () => {
    assert.throws(() => obterCriador('ensaio'), ErroPergunta);
    assert.throws(() => obterCriador(undefined), ErroPergunta);
    assert.throws(() => obterCriador('toString'), ErroPergunta);
  });
});

describe('CriadorPergunta', () => {
  it('o método fábrica da classe base tem de ser redefinido', () => {
    assert.throws(() => new CriadorPergunta().criarPergunta({}), /implementado/);
  });

  it('os criadores concretos rejeitam dados que não sejam objetos', () => {
    assert.throws(() => obterCriador('vf').criarPergunta(null), ErroPergunta);
  });
});

describe('Escolha múltipla', () => {
  const dados = {
    enunciado: 'Que padrão delega a criação de objetos nas subclasses?',
    correta: 'Factory Method',
    opcoes: ['Singleton', 'Factory Method', 'Observer'],
  };

  it('cria uma EscolhaMultipla, que é uma Pergunta', () => {
    const p = obterCriador('multipla').criarPergunta(dados);
    assert.ok(p instanceof EscolhaMultipla);
    assert.ok(p instanceof Pergunta);
    assert.deepEqual(p.opcoes, dados.opcoes);
  });

  it('verifica a resposta', () => {
    const p = obterCriador('multipla').criarPergunta(dados);
    assert.equal(p.verificar('Factory Method'), true);
    assert.equal(p.verificar('Singleton'), false);
  });

  it('rejeita opções em falta ou sem a resposta correta', () => {
    const criador = obterCriador('multipla');
    assert.throws(() => criador.criarPergunta({ ...dados, opcoes: undefined }), ErroPergunta);
    assert.throws(() => criador.criarPergunta({ ...dados, correta: 'Adapter' }), ErroPergunta);
  });
});

describe('Verdadeiro ou falso', () => {
  it('cria um VerdadeiroFalso e verifica a resposta', () => {
    const p = obterCriador('vf').criarPergunta({
      enunciado: 'O Singleton garante uma única instância.',
      correta: true,
    });
    assert.ok(p instanceof VerdadeiroFalso);
    assert.equal(p.verificar(true), true);
    assert.equal(p.verificar('verdadeiro'), true);
    assert.equal(p.verificar(false), false);
    assert.equal(p.verificar('talvez'), false);
  });

  it('rejeita uma resposta correta que não seja verdadeiro ou falso', () => {
    assert.throws(
      () => obterCriador('vf').criarPergunta({ enunciado: 'Pergunta', correta: 'sim' }),
      ErroPergunta,
    );
  });
});

describe('Resposta curta', () => {
  const p = obterCriador('curta').criarPergunta({
    enunciado: 'Qual o padrão que notifica observadores?',
    correta: 'Observer',
  });

  it('cria uma RespostaCurta', () => {
    assert.ok(p instanceof RespostaCurta);
  });

  it('não distingue maiúsculas e ignora espaços', () => {
    assert.equal(p.verificar('observer'), true);
    assert.equal(p.verificar('  OBSERVER  '), true);
    assert.equal(p.verificar('Obs erver'), true);
    assert.equal(p.verificar('Observador'), false);
    assert.equal(p.verificar(42), false);
  });
});

describe('Pergunta (classe base)', () => {
  it('rejeita um enunciado vazio', () => {
    assert.throws(() => new Pergunta('   ', 'x'), ErroPergunta);
  });

  it('rejeita a falta da resposta correta', () => {
    assert.throws(() => new Pergunta('Enunciado', undefined), ErroPergunta);
  });
});

describe('Banco de perguntas', () => {
  const { bancoPerguntas, paraAluno } = require('../banco-perguntas');

  it('todas as perguntas são válidas para o Factory Method', () => {
    for (const dados of bancoPerguntas) {
      const pergunta = obterCriador(dados.tipo).criarPergunta(dados);
      assert.equal(pergunta.verificar(dados.correta), true, dados.id);
    }
  });

  it('os identificadores são únicos', () => {
    const ids = bancoPerguntas.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('paraAluno retira a resposta correta', () => {
    for (const dados of bancoPerguntas) {
      assert.equal('correta' in paraAluno(dados), false);
    }
  });
});
