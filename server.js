'use strict';

/**
 * server.js
 *
 * Activity Provider para a plataforma Inven!RA: questionário sobre padrões
 * de projeto. Expõe os endereços que a Inven!RA usa para configurar,
 * instalar (deploy) e obter analytics da atividade, a página do questionário
 * para o aluno, o relatório do aluno e os endpoints de correção, que usam o
 * padrão Factory Method (perguntas.js).
 */

const express = require('express');
const { obterCriador, ErroPergunta } = require('./perguntas');
const { bancoPerguntas, obterPergunta, paraAluno } = require('./banco-perguntas');
const { alunosExemplo, obterAlunoExemplo } = require('./dados-exemplo');
const { paginaConfig, paginaQuestionario, paginaRelatorio, paginaErro } = require('./paginas');

const app = express();
const PORT = process.env.PORT || 3000;

/** Título do questionário quando a Inven!RA não indica outro. */
const TITULO_POR_OMISSAO = 'Questionário sobre padrões de projeto';
/** Número de perguntas quando a Inven!RA não indica outro. */
const NUM_PERGUNTAS_POR_OMISSAO = 5;

app.disable('x-powered-by');

// Lê o corpo JSON dos pedidos POST.
app.use(express.json());

// ---------------------------------------------------------------------------
// Funções auxiliares
// ---------------------------------------------------------------------------

/** Responde com o código 400 e uma mensagem de erro em JSON. */
function erroPedido(res, mensagem) {
  return res.status(400).json({ erro: mensagem });
}

/** Responde com uma página HTML de erro. */
function erroPagina(res, estado, titulo, mensagem) {
  return res.status(estado).type('html').send(paginaErro(titulo, mensagem));
}

/**
 * Devolve o URL base da aplicação, sem barra final.
 * Usa a variável de ambiente BASE_URL; se não existir (por exemplo, em
 * desenvolvimento), usa o protocolo e o anfitrião do próprio pedido.
 */
function obterBaseUrl(req) {
  const base = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  return base.replace(/\/+$/, '');
}

/** Verifica se um valor é um texto com pelo menos um carácter visível. */
function eTextoNaoVazio(valor) {
  return typeof valor === 'string' && valor.trim() !== '';
}

/**
 * Cria as perguntas a partir dos dados recebidos, usando o Factory Method:
 * obtém o criador pelo tipo e chama o método fábrica criarPergunta, sem
 * referir as classes concretas.
 * @param {object[]} lista Dados das perguntas ({ tipo, enunciado, correta, opcoes }).
 * @returns {import('./perguntas').Pergunta[]}
 * @throws {ErroPergunta} Com a posição da pergunta inválida na mensagem.
 */
function criarPerguntas(lista) {
  return lista.map((dados, i) => {
    try {
      const tipo = dados !== null && typeof dados === 'object' ? dados.tipo : undefined;
      return obterCriador(tipo).criarPergunta(dados);
    } catch (erro) {
      if (erro instanceof ErroPergunta) {
        throw new ErroPergunta(`Pergunta ${i + 1}: ${erro.message}`);
      }
      throw erro; // Erro inesperado: segue para o tratamento de erros geral.
    }
  });
}

/** Conta quantas respostas estão certas. */
function contarCertas(perguntas, respostas) {
  return perguntas.filter((pergunta, i) => pergunta.verificar(respostas[i])).length;
}

// ---------------------------------------------------------------------------
// 1. Página de configuração da atividade
// ---------------------------------------------------------------------------

app.get('/config', (req, res) => {
  res.type('html').send(paginaConfig());
});

// ---------------------------------------------------------------------------
// 2. Parâmetros de configuração
// ---------------------------------------------------------------------------

app.get('/json-params', (req, res) => {
  res.json([
    { name: 'titulo', type: 'text/plain' },
    { name: 'numPerguntas', type: 'integer' },
  ]);
});

// ---------------------------------------------------------------------------
// 3. Instalação (deploy) da atividade
// ---------------------------------------------------------------------------

app.get('/deploy', (req, res) => {
  const { activityID } = req.query;
  if (!eTextoNaoVazio(activityID)) {
    return erroPedido(res, 'O parâmetro "activityID" é obrigatório.');
  }
  const url = `${obterBaseUrl(req)}/questionario?id=${encodeURIComponent(activityID)}`;
  res.type('text/plain').send(url);
});

// ---------------------------------------------------------------------------
// 4. Lista de analytics disponíveis
// ---------------------------------------------------------------------------

app.get('/analytics-list', (req, res) => {
  res.json({
    qualAnalytics: [{ name: 'Relatório do aluno', type: 'URL' }],
    quantAnalytics: [
      { name: 'Respostas certas', type: 'integer' },
      { name: 'Tempo total (s)', type: 'integer' },
    ],
  });
});

// ---------------------------------------------------------------------------
// 5. Analytics da atividade (dados de exemplo)
// ---------------------------------------------------------------------------

app.post('/analytics', (req, res) => {
  const { activityID } = req.body ?? {};
  if (!eTextoNaoVazio(activityID)) {
    return erroPedido(res, 'O campo "activityID" é obrigatório.');
  }

  const base = obterBaseUrl(req);
  const id = encodeURIComponent(activityID);

  res.json(
    alunosExemplo.map((aluno) => ({
      inveniraStdID: aluno.inveniraStdID,
      quantAnalytics: [
        { name: 'Respostas certas', value: aluno.certas },
        { name: 'Tempo total (s)', value: aluno.tempo },
      ],
      qualAnalytics: [
        {
          name: 'Relatório do aluno',
          value: `${base}/relatorio?id=${id}&aluno=${aluno.inveniraStdID}`,
        },
      ],
    })),
  );
});

// ---------------------------------------------------------------------------
// Página do questionário (URL devolvido por /deploy)
// ---------------------------------------------------------------------------

/**
 * GET /questionario?id=...[&titulo=...][&numPerguntas=...]
 * Mostra ao aluno as primeiras numPerguntas perguntas do banco, sem as
 * respostas corretas.
 */
app.get('/questionario', (req, res) => {
  const { id, titulo, numPerguntas } = req.query;

  if (!eTextoNaoVazio(id)) {
    return erroPagina(res, 400, 'Pedido inválido', 'O parâmetro "id" da atividade é obrigatório.');
  }

  let quantas = NUM_PERGUNTAS_POR_OMISSAO;
  if (numPerguntas !== undefined) {
    quantas = Number(numPerguntas);
    if (!Number.isInteger(quantas) || quantas < 1) {
      return erroPagina(res, 400, 'Pedido inválido', 'O parâmetro "numPerguntas" tem de ser um número inteiro positivo.');
    }
  }
  // Não é possível mostrar mais perguntas do que as que existem no banco.
  quantas = Math.min(quantas, bancoPerguntas.length);

  res.type('html').send(
    paginaQuestionario({
      activityID: id,
      titulo: eTextoNaoVazio(titulo) ? titulo : TITULO_POR_OMISSAO,
      perguntas: bancoPerguntas.slice(0, quantas).map(paraAluno),
    }),
  );
});

/**
 * POST /questionario/responder
 * Recebe { activityID, ids: [...], respostas: [...], tempo } da página do
 * questionário. As perguntas vêm do banco do servidor (as soluções nunca
 * passam pelo browser) e são criadas e corrigidas com o Factory Method.
 * O campo "tempo" (segundos) é aceite, mas ainda não é guardado.
 */
app.post('/questionario/responder', (req, res) => {
  const { activityID, ids, respostas } = req.body ?? {};

  if (!eTextoNaoVazio(activityID)) {
    return erroPedido(res, 'O campo "activityID" é obrigatório.');
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    return erroPedido(res, 'O campo "ids" tem de ser uma lista não vazia.');
  }
  if (!Array.isArray(respostas) || respostas.length !== ids.length) {
    return erroPedido(res, 'O campo "respostas" tem de ser uma lista com uma resposta por pergunta.');
  }

  const dados = [];
  for (const id of ids) {
    const pergunta = obterPergunta(id);
    if (!pergunta) {
      return erroPedido(res, `Pergunta desconhecida: "${id}".`);
    }
    dados.push(pergunta);
  }

  const perguntas = criarPerguntas(dados);
  res.json({ certas: contarCertas(perguntas, respostas), total: perguntas.length });
});

/**
 * POST /questionario/corrigir
 * Recebe { perguntas: [{ tipo, enunciado, correta, opcoes }], respostas: [...] }
 * e devolve { certas, total }.
 */
app.post('/questionario/corrigir', (req, res) => {
  const { perguntas, respostas } = req.body ?? {};

  if (!Array.isArray(perguntas) || perguntas.length === 0) {
    return erroPedido(res, 'O campo "perguntas" tem de ser uma lista não vazia.');
  }
  if (!Array.isArray(respostas)) {
    return erroPedido(res, 'O campo "respostas" tem de ser uma lista.');
  }
  if (respostas.length !== perguntas.length) {
    return erroPedido(res, 'O número de respostas tem de ser igual ao número de perguntas.');
  }

  // Cria todas as perguntas antes de corrigir, para validar o pedido inteiro.
  let criadas;
  try {
    criadas = criarPerguntas(perguntas);
  } catch (erro) {
    if (erro instanceof ErroPergunta) return erroPedido(res, erro.message);
    throw erro;
  }

  res.json({ certas: contarCertas(criadas, respostas), total: criadas.length });
});

// ---------------------------------------------------------------------------
// Relatório do aluno (analytics qualitativa)
// ---------------------------------------------------------------------------

/**
 * GET /relatorio?id=...&aluno=...
 * Mostra o relatório de um aluno de exemplo numa atividade.
 */
app.get('/relatorio', (req, res) => {
  const { id, aluno } = req.query;

  if (!eTextoNaoVazio(id) || !eTextoNaoVazio(aluno)) {
    return erroPagina(res, 400, 'Pedido inválido', 'Os parâmetros "id" e "aluno" são obrigatórios.');
  }

  const dadosAluno = obterAlunoExemplo(aluno);
  if (!dadosAluno) {
    return erroPagina(res, 404, 'Aluno não encontrado', `Não existe relatório para o aluno "${aluno}".`);
  }

  res.type('html').send(paginaRelatorio({ activityID: id, aluno: dadosAluno }));
});

// ---------------------------------------------------------------------------
// Tratamento de erros
// ---------------------------------------------------------------------------

// Endereço inexistente.
app.use((req, res) => {
  res.status(404).json({ erro: 'Endereço não encontrado.' });
});

// Erros gerais (por exemplo, JSON mal formado no corpo do pedido).
// eslint-disable-next-line no-unused-vars
app.use((erro, req, res, next) => {
  if (erro.type === 'entity.parse.failed') {
    return erroPedido(res, 'O corpo do pedido não é JSON válido.');
  }
  const estado = erro.status || erro.statusCode;
  if (estado >= 400 && estado < 500) {
    return res.status(estado).json({ erro: erro.message });
  }
  console.error(erro);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

// Só arranca o servidor quando o ficheiro é executado diretamente
// (os testes importam a aplicação sem abrir a porta).
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Activity Provider a correr na porta ${PORT}`);
  });
}

module.exports = app;
