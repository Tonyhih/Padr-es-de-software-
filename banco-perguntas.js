'use strict';

/**
 * banco-perguntas.js
 *
 * Banco de perguntas do questionário sobre padrões de projeto.
 * Cada pergunta tem o mesmo formato aceite pelo Factory Method
 * (tipo, enunciado, correta, opcoes) e um identificador único.
 *
 * As respostas corretas ficam apenas no servidor: a página do aluno
 * recebe só o enunciado e as opções (ver paraAluno).
 */

const bancoPerguntas = [
  {
    id: 'p1',
    tipo: 'multipla',
    enunciado: 'Que padrão define uma interface para criar um objeto, deixando as subclasses decidir que classe instanciar?',
    opcoes: ['Singleton', 'Factory Method', 'Observer', 'Adapter'],
    correta: 'Factory Method',
  },
  {
    id: 'p2',
    tipo: 'vf',
    enunciado: 'O padrão Singleton garante que uma classe tem apenas uma instância.',
    correta: true,
  },
  {
    id: 'p3',
    tipo: 'curta',
    enunciado: 'Que padrão notifica automaticamente vários objetos quando o estado de outro objeto muda?',
    correta: 'Observer',
  },
  {
    id: 'p4',
    tipo: 'multipla',
    enunciado: 'A que categoria pertence o padrão Adapter?',
    opcoes: ['Criação', 'Estrutural', 'Comportamental'],
    correta: 'Estrutural',
  },
  {
    id: 'p5',
    tipo: 'vf',
    enunciado: 'O padrão Strategy é um padrão de criação.',
    correta: false,
  },
  {
    id: 'p6',
    tipo: 'curta',
    enunciado: 'Que padrão converte a interface de uma classe noutra interface que o cliente espera?',
    correta: 'Adapter',
  },
  {
    id: 'p7',
    tipo: 'multipla',
    enunciado: 'Que padrão acrescenta responsabilidades a um objeto de forma dinâmica?',
    opcoes: ['Decorator', 'Facade', 'Builder', 'Prototype'],
    correta: 'Decorator',
  },
  {
    id: 'p8',
    tipo: 'vf',
    enunciado: 'O padrão Facade fornece uma interface simplificada para um subsistema.',
    correta: true,
  },
  {
    id: 'p9',
    tipo: 'curta',
    enunciado: 'Que padrão separa a construção de um objeto complexo da sua representação?',
    correta: 'Builder',
  },
  {
    id: 'p10',
    tipo: 'multipla',
    enunciado: 'Qual destes é um padrão comportamental?',
    opcoes: ['Composite', 'Proxy', 'Command', 'Abstract Factory'],
    correta: 'Command',
  },
];

/** Índice por identificador, para pesquisas rápidas. */
const porId = new Map(bancoPerguntas.map((p) => [p.id, p]));

/**
 * Devolve a pergunta do banco com o identificador dado, ou undefined.
 * @param {string} id
 */
function obterPergunta(id) {
  return porId.get(id);
}

/**
 * Devolve uma cópia da pergunta sem a resposta correta, para enviar ao aluno.
 * @param {object} pergunta
 */
function paraAluno(pergunta) {
  const { correta, ...visivel } = pergunta; // eslint-disable-line no-unused-vars
  return visivel;
}

module.exports = { bancoPerguntas, obterPergunta, paraAluno };
