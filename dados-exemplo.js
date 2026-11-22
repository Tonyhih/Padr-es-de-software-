'use strict';

/**
 * dados-exemplo.js
 *
 * Alunos de exemplo usados por POST /analytics e por GET /relatorio.
 * Numa versão real estes dados viriam de uma base de dados.
 */

const alunosExemplo = [
  { inveniraStdID: 1001, certas: 4, total: 5, tempo: 312 },
  { inveniraStdID: 1002, certas: 2, total: 5, tempo: 455 },
  { inveniraStdID: 1003, certas: 5, total: 5, tempo: 198 },
];

/**
 * Procura um aluno de exemplo pelo identificador Inven!RA.
 * Aceita o identificador como número ou como texto (vindo do URL).
 * @param {number|string} id
 */
function obterAlunoExemplo(id) {
  return alunosExemplo.find((aluno) => String(aluno.inveniraStdID) === String(id));
}

module.exports = { alunosExemplo, obterAlunoExemplo };
