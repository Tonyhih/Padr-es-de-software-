'use strict';

/**
 * perguntas.js
 *
 * Implementação do padrão de criação Factory Method para as perguntas do
 * questionário sobre padrões de projeto.
 *
 * Participantes do padrão:
 *   - Produto ............ Pergunta
 *   - Produtos concretos . EscolhaMultipla, VerdadeiroFalso, RespostaCurta
 *   - Criador ............ CriadorPergunta (declara o método fábrica criarPergunta)
 *   - Criadores concretos  CriadorEscolhaMultipla, CriadorVerdadeiroFalso, CriadorRespostaCurta
 *
 * O código cliente (por exemplo, o servidor) obtém um criador através de
 * obterCriador(tipo) e chama criarPergunta(dados), sem nunca referir as
 * classes concretas das perguntas.
 */

/**
 * Erro lançado quando os dados de uma pergunta são inválidos ou o tipo é
 * desconhecido. Permite ao servidor distinguir erros do pedido (400) de
 * erros internos (500).
 */
class ErroPergunta extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = 'ErroPergunta';
  }
}

// ---------------------------------------------------------------------------
// Funções auxiliares
// ---------------------------------------------------------------------------

/** Verifica se um valor é um texto com pelo menos um carácter visível. */
function eTextoNaoVazio(valor) {
  return typeof valor === 'string' && valor.trim() !== '';
}

/**
 * Converte uma resposta de verdadeiro/falso num booleano.
 * Aceita true/false e os textos "true", "false", "verdadeiro", "falso", "v" e "f".
 * Devolve null se o valor não for reconhecido.
 */
function paraBooleano(valor) {
  if (typeof valor === 'boolean') return valor;
  if (typeof valor !== 'string') return null;
  const texto = valor.trim().toLocaleLowerCase('pt-PT');
  if (['true', 'verdadeiro', 'v'].includes(texto)) return true;
  if (['false', 'falso', 'f'].includes(texto)) return false;
  return null;
}

/** Normaliza um texto: remove todos os espaços e converte para minúsculas. */
function normalizarTexto(texto) {
  return texto.replace(/\s+/g, '').toLocaleLowerCase('pt-PT');
}

// ---------------------------------------------------------------------------
// Produto e produtos concretos
// ---------------------------------------------------------------------------

/**
 * Produto: interface comum a todas as perguntas.
 */
class Pergunta {
  /**
   * @param {string} enunciado Texto da pergunta.
   * @param {*} correta Resposta correta.
   */
  constructor(enunciado, correta) {
    if (!eTextoNaoVazio(enunciado)) {
      throw new ErroPergunta('O campo "enunciado" tem de ser um texto não vazio.');
    }
    if (correta === undefined || correta === null) {
      throw new ErroPergunta('O campo "correta" é obrigatório.');
    }
    this.enunciado = enunciado;
    this.correta = correta;
  }

  /**
   * Indica se a resposta dada está correta.
   * Por omissão faz uma comparação estrita; as subclasses podem redefinir.
   * @param {*} resposta Resposta do aluno.
   * @returns {boolean}
   */
  verificar(resposta) {
    return resposta === this.correta;
  }
}

/**
 * Produto concreto: pergunta de escolha múltipla.
 * A resposta correta tem de ser uma das opções.
 */
class EscolhaMultipla extends Pergunta {
  constructor(enunciado, correta, opcoes) {
    super(enunciado, correta);
    if (!Array.isArray(opcoes) || opcoes.length < 2) {
      throw new ErroPergunta('O campo "opcoes" tem de ser uma lista com pelo menos duas opções.');
    }
    if (!opcoes.includes(correta)) {
      throw new ErroPergunta('A resposta "correta" tem de ser uma das "opcoes".');
    }
    this.opcoes = [...opcoes];
  }

  // Herda verificar(): a resposta tem de ser exatamente a opção correta.
}

/**
 * Produto concreto: pergunta de verdadeiro ou falso.
 */
class VerdadeiroFalso extends Pergunta {
  constructor(enunciado, correta) {
    super(enunciado, correta);
    const valor = paraBooleano(correta);
    if (valor === null) {
      throw new ErroPergunta('Numa pergunta "vf", o campo "correta" tem de ser verdadeiro ou falso.');
    }
    this.correta = valor;
  }

  verificar(resposta) {
    return paraBooleano(resposta) === this.correta;
  }
}

/**
 * Produto concreto: pergunta de resposta curta.
 * A comparação não distingue maiúsculas de minúsculas e ignora os espaços.
 */
class RespostaCurta extends Pergunta {
  constructor(enunciado, correta) {
    super(enunciado, correta);
    if (!eTextoNaoVazio(correta)) {
      throw new ErroPergunta('Numa pergunta "curta", o campo "correta" tem de ser um texto não vazio.');
    }
  }

  verificar(resposta) {
    if (typeof resposta !== 'string') return false;
    return normalizarTexto(resposta) === normalizarTexto(this.correta);
  }
}

// ---------------------------------------------------------------------------
// Criador e criadores concretos
// ---------------------------------------------------------------------------

/**
 * Criador: declara o método fábrica criarPergunta(dados).
 * Não deve ser usado diretamente; cada subclasse decide que pergunta cria.
 */
class CriadorPergunta {
  /**
   * Método fábrica.
   * @param {object} dados Dados da pergunta ({ enunciado, correta, opcoes }).
   * @returns {Pergunta}
   */
  // eslint-disable-next-line no-unused-vars
  criarPergunta(dados) {
    throw new Error('O método criarPergunta(dados) tem de ser implementado pelas subclasses.');
  }

  /**
   * Garante que os dados recebidos são um objeto (usado pelos criadores concretos).
   * @param {*} dados
   * @returns {object}
   */
  validarDados(dados) {
    if (dados === null || typeof dados !== 'object' || Array.isArray(dados)) {
      throw new ErroPergunta('Os dados da pergunta têm de ser um objeto.');
    }
    return dados;
  }
}

/** Criador concreto de perguntas de escolha múltipla. */
class CriadorEscolhaMultipla extends CriadorPergunta {
  criarPergunta(dados) {
    this.validarDados(dados);
    return new EscolhaMultipla(dados.enunciado, dados.correta, dados.opcoes);
  }
}

/** Criador concreto de perguntas de verdadeiro ou falso. */
class CriadorVerdadeiroFalso extends CriadorPergunta {
  criarPergunta(dados) {
    this.validarDados(dados);
    return new VerdadeiroFalso(dados.enunciado, dados.correta);
  }
}

/** Criador concreto de perguntas de resposta curta. */
class CriadorRespostaCurta extends CriadorPergunta {
  criarPergunta(dados) {
    this.validarDados(dados);
    return new RespostaCurta(dados.enunciado, dados.correta);
  }
}

// ---------------------------------------------------------------------------
// Registo de criadores
// ---------------------------------------------------------------------------

/**
 * Registo que associa cada tipo de pergunta ao respetivo criador.
 * Para acrescentar um novo tipo basta criar o produto, o criador e
 * registá-lo aqui; o servidor não precisa de ser alterado.
 */
const registoCriadores = new Map([
  ['multipla', new CriadorEscolhaMultipla()],
  ['vf', new CriadorVerdadeiroFalso()],
  ['curta', new CriadorRespostaCurta()],
]);

/**
 * Devolve o criador associado a um tipo de pergunta.
 * @param {string} tipo "multipla", "vf" ou "curta".
 * @returns {CriadorPergunta}
 * @throws {ErroPergunta} Se o tipo for desconhecido.
 */
function obterCriador(tipo) {
  const criador = registoCriadores.get(tipo);
  if (!criador) {
    const validos = [...registoCriadores.keys()].join(', ');
    throw new ErroPergunta(`Tipo de pergunta desconhecido: "${tipo}". Tipos válidos: ${validos}.`);
  }
  return criador;
}

module.exports = {
  ErroPergunta,
  Pergunta,
  EscolhaMultipla,
  VerdadeiroFalso,
  RespostaCurta,
  CriadorPergunta,
  CriadorEscolhaMultipla,
  CriadorVerdadeiroFalso,
  CriadorRespostaCurta,
  registoCriadores,
  obterCriador,
};
