'use strict';

/**
 * paginas.js
 *
 * Geração das páginas HTML do Activity Provider: configuração, questionário,
 * relatório do aluno e páginas de erro. Todo o texto variável é escapado
 * antes de ser inserido no HTML.
 */

/** Escapa os caracteres especiais de HTML. */
function escaparHtml(valor) {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Estilos partilhados por todas as páginas. */
const ESTILOS = `
  :root { color-scheme: light dark; --realce: #2563eb; --borda: #8884; }
  body { font-family: system-ui, sans-serif; max-width: 46rem; margin: 0 auto; padding: 1.5rem 1rem; line-height: 1.5; }
  h1 { font-size: 1.6rem; margin-top: 0; }
  fieldset { border: 1px solid var(--borda); border-radius: .5rem; margin: 0 0 1rem; padding: 1rem; }
  legend { font-weight: 600; padding: 0 .3rem; }
  label { display: block; margin: .3rem 0; }
  input[type=text], input[type=number] { font: inherit; padding: .4rem; width: 100%; max-width: 24rem; box-sizing: border-box; }
  button { font: inherit; padding: .5rem 1.2rem; border: 0; border-radius: .4rem; background: var(--realce); color: #fff; cursor: pointer; }
  button:disabled { opacity: .6; cursor: default; }
  table { border-collapse: collapse; }
  th, td { text-align: left; padding: .4rem .8rem; border-bottom: 1px solid var(--borda); }
  .resultado { font-size: 1.2rem; font-weight: 600; margin-top: 1rem; }
  .barra { margin: 1rem 0; height: .8rem; background: var(--borda); border-radius: .4rem; overflow: hidden; max-width: 24rem; }
  .barra > div { height: 100%; background: var(--realce); }
`;

/** Estrutura comum das páginas. */
function pagina(titulo, corpo) {
  return `<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escaparHtml(titulo)}</title>
  <style>${ESTILOS}</style>
</head>
<body>
${corpo}
</body>
</html>`;
}

/** Página de configuração (GET /config). */
function paginaConfig() {
  return pagina('Configuração do questionário', `
  <h1>Questionário sobre padrões de projeto</h1>
  <p>
    <label for="titulo">Título</label>
    <input type="text" id="titulo" name="titulo" value="Padrões de projeto">
  </p>
  <p>
    <label for="numPerguntas">Número de perguntas</label>
    <input type="number" id="numPerguntas" name="numPerguntas" min="1" step="1" value="5">
  </p>`);
}

/** HTML de uma pergunta do questionário, consoante o tipo. */
function htmlPergunta(pergunta, indice) {
  const nome = `resposta-${indice}`;
  let campos;
  if (pergunta.tipo === 'multipla') {
    campos = pergunta.opcoes
      .map((opcao) => `<label><input type="radio" name="${nome}" value="${escaparHtml(opcao)}"> ${escaparHtml(opcao)}</label>`)
      .join('\n      ');
  } else if (pergunta.tipo === 'vf') {
    campos = `<label><input type="radio" name="${nome}" value="verdadeiro"> Verdadeiro</label>
      <label><input type="radio" name="${nome}" value="falso"> Falso</label>`;
  } else {
    campos = `<input type="text" name="${nome}" autocomplete="off" aria-label="Resposta à pergunta ${indice + 1}">`;
  }
  return `
    <fieldset data-id="${escaparHtml(pergunta.id)}" data-tipo="${escaparHtml(pergunta.tipo)}">
      <legend>${indice + 1}. ${escaparHtml(pergunta.enunciado)}</legend>
      ${campos}
    </fieldset>`;
}

/**
 * Página do questionário (GET /questionario).
 * @param {object} opcoes
 * @param {string} opcoes.activityID Identificador da atividade.
 * @param {string} opcoes.titulo Título a mostrar.
 * @param {object[]} opcoes.perguntas Perguntas sem a resposta correta.
 */
function paginaQuestionario({ activityID, titulo, perguntas }) {
  // Os dados passam para o script em JSON; "<" é escapado para não fechar o <script>.
  const dados = JSON.stringify({ activityID, ids: perguntas.map((p) => p.id) }).replace(/</g, '\\u003c');

  return pagina(titulo, `
  <h1>${escaparHtml(titulo)}</h1>
  <form id="questionario">
    ${perguntas.map(htmlPergunta).join('\n')}
    <button type="submit">Submeter respostas</button>
  </form>
  <p id="resultado" class="resultado" role="status"></p>

  <script>
    (function () {
      const dados = ${dados};
      const formulario = document.getElementById('questionario');
      const resultado = document.getElementById('resultado');
      const inicio = Date.now();

      // Lê a resposta de cada pergunta (null se não tiver resposta).
      function lerRespostas() {
        return Array.from(formulario.querySelectorAll('fieldset')).map(function (campo) {
          if (campo.dataset.tipo === 'curta') return campo.querySelector('input').value;
          const escolhida = campo.querySelector('input:checked');
          return escolhida ? escolhida.value : null;
        });
      }

      formulario.addEventListener('submit', async function (evento) {
        evento.preventDefault();
        const botao = formulario.querySelector('button');
        botao.disabled = true;
        resultado.textContent = 'A corrigir...';
        try {
          const resposta = await fetch('questionario/responder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              activityID: dados.activityID,
              ids: dados.ids,
              respostas: lerRespostas(),
              tempo: Math.round((Date.now() - inicio) / 1000),
            }),
          });
          const corpo = await resposta.json();
          if (!resposta.ok) throw new Error(corpo.erro || 'Erro ao corrigir.');
          resultado.textContent = 'Acertaste ' + corpo.certas + ' de ' + corpo.total + ' perguntas.';
        } catch (erro) {
          resultado.textContent = erro.message;
          botao.disabled = false;
        }
      });
    })();
  </script>`);
}

/** Formata segundos como "5 min 12 s". */
function formatarTempo(segundos) {
  const min = Math.floor(segundos / 60);
  const s = segundos % 60;
  return min > 0 ? `${min} min ${s} s` : `${s} s`;
}

/**
 * Página do relatório de um aluno (GET /relatorio).
 * @param {object} opcoes
 * @param {string} opcoes.activityID
 * @param {object} opcoes.aluno { inveniraStdID, certas, total, tempo }
 */
function paginaRelatorio({ activityID, aluno }) {
  const percentagem = aluno.total > 0 ? Math.round((aluno.certas / aluno.total) * 100) : 0;
  return pagina(`Relatório do aluno ${aluno.inveniraStdID}`, `
  <h1>Relatório do aluno</h1>
  <table>
    <tr><th>Atividade</th><td>${escaparHtml(activityID)}</td></tr>
    <tr><th>Aluno (Inven!RA)</th><td>${escaparHtml(aluno.inveniraStdID)}</td></tr>
    <tr><th>Respostas certas</th><td>${aluno.certas} de ${aluno.total} (${percentagem}%)</td></tr>
    <tr><th>Tempo total</th><td>${formatarTempo(aluno.tempo)}</td></tr>
  </table>
  <div class="barra" aria-hidden="true"><div style="width: ${percentagem}%"></div></div>
  <p><small>Dados de exemplo.</small></p>`);
}

/** Página de erro simples, para os endereços que devolvem HTML. */
function paginaErro(titulo, mensagem) {
  return pagina(titulo, `
  <h1>${escaparHtml(titulo)}</h1>
  <p>${escaparHtml(mensagem)}</p>`);
}

module.exports = { escaparHtml, paginaConfig, paginaQuestionario, paginaRelatorio, paginaErro };
