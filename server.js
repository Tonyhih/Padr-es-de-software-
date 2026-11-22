'use strict';

/**
 * server.js
 *
 * Activity Provider para a plataforma Inven!RA: questionário sobre padrões
 * de projeto. Expõe os endereços que a Inven!RA usa para configurar,
 * instalar (deploy) e obter analytics da atividade, e ainda o endpoint
 * POST /questionario/corrigir, que usa o padrão Factory Method (perguntas.js).
 *
 * Nota: o serviço "Provide activity" (GET /questionario) não está implementado.
 */

const express = require('express');
const { obterCriador, ErroPergunta } = require('./perguntas');

const app = express();
const PORT = process.env.PORT || 3000;

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

// ---------------------------------------------------------------------------
// 1. Página de configuração da atividade
// ---------------------------------------------------------------------------

const PAGINA_CONFIG = `<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Configuração do questionário</title>
</head>
<body>
  <h1>Questionário sobre padrões de projeto</h1>
  <p>
    <label for="titulo">Título</label><br>
    <input type="text" id="titulo" name="titulo" value="Padrões de projeto">
  </p>
  <p>
    <label for="numPerguntas">Número de perguntas</label><br>
    <input type="number" id="numPerguntas" name="numPerguntas" min="1" step="1" value="5">
  </p>
</body>
</html>`;

app.get('/config', (req, res) => {
  res.type('html').send(PAGINA_CONFIG);
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

  // Dados de exemplo: numa versão real viriam de uma base de dados.
  const exemplos = [
    { inveniraStdID: 1001, certas: 4, tempo: 312 },
    { inveniraStdID: 1002, certas: 2, tempo: 455 },
    { inveniraStdID: 1003, certas: 5, tempo: 198 },
  ];

  res.json(
    exemplos.map((aluno) => ({
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
// Correção do questionário (Factory Method)
// ---------------------------------------------------------------------------

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
  // O servidor só conhece o criador devolvido pelo registo e o método
  // fábrica criarPergunta: nunca refere as classes concretas.
  const criadas = [];
  for (let i = 0; i < perguntas.length; i++) {
    const dados = perguntas[i];
    try {
      const tipo = dados !== null && typeof dados === 'object' ? dados.tipo : undefined;
      const criador = obterCriador(tipo);
      criadas.push(criador.criarPergunta(dados));
    } catch (erro) {
      if (erro instanceof ErroPergunta) {
        return erroPedido(res, `Pergunta ${i + 1}: ${erro.message}`);
      }
      throw erro; // Erro inesperado: segue para o tratamento de erros geral.
    }
  }

  const certas = criadas.filter((pergunta, i) => pergunta.verificar(respostas[i])).length;
  res.json({ certas, total: criadas.length });
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
