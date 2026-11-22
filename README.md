# Questionário sobre padrões de projeto — Activity Provider Inven!RA

Activity Provider para a plataforma [Inven!RA](https://inven-ra.net), feito em
Node.js com Express. A atividade é um questionário sobre padrões de projeto e a
correção das perguntas usa o padrão de criação **Factory Method**.

## Estrutura

```
.
├── server.js            # Aplicação Express e endereços da Inven!RA
├── perguntas.js         # Factory Method: perguntas, criadores e registo
├── test/
│   ├── perguntas.test.js  # Testes do Factory Method
│   └── servidor.test.js   # Testes dos endpoints
└── docs/
    ├── componentes-factory-method.puml  # Diagrama de componentes
    └── sequencia-corrigir.puml          # Sequência de POST /questionario/corrigir
```

## Instalar e correr localmente

Requisitos: Node.js 18 ou superior.

```bash
npm install
npm start
```

O servidor fica disponível em <http://localhost:3000> (ou na porta definida em
`PORT`). Para correr os testes:

```bash
npm test
```

### Variáveis de ambiente

| Variável   | Descrição                                                                 | Por omissão                    |
|------------|---------------------------------------------------------------------------|--------------------------------|
| `PORT`     | Porta onde o servidor escuta.                                             | `3000`                         |
| `BASE_URL` | URL público da aplicação, usado em `/deploy` e nos relatórios de analytics. | Protocolo e anfitrião do pedido |

Exemplo: `BASE_URL=https://meu-ap.onrender.com npm start`

## Endereços

| Método | Endereço                  | Descrição                                                                 |
|--------|---------------------------|---------------------------------------------------------------------------|
| GET    | `/config`                 | Página HTML com os campos `titulo` e `numPerguntas`.                      |
| GET    | `/json-params`            | Lista dos parâmetros de configuração.                                     |
| GET    | `/deploy?activityID=...`  | Devolve (texto) o URL `BASE_URL/questionario?id=activityID`.              |
| GET    | `/analytics-list`         | Analytics qualitativas e quantitativas disponíveis.                       |
| POST   | `/analytics`              | Recebe `{ "activityID": "..." }` e devolve analytics de alunos de exemplo. |
| POST   | `/questionario/corrigir`  | Corrige um questionário e devolve `{ certas, total }`.                    |

O serviço *Provide activity* (`GET /questionario`) não está implementado.

Pedidos inválidos (parâmetros em falta, JSON mal formado, tipo de pergunta
desconhecido, dados de pergunta inválidos) recebem a resposta `400` com
`{ "erro": "..." }`.

### Exemplos

```bash
curl "http://localhost:3000/deploy?activityID=abc123"

curl -X POST http://localhost:3000/analytics \
  -H "Content-Type: application/json" \
  -d '{"activityID": "abc123"}'

curl -X POST http://localhost:3000/questionario/corrigir \
  -H "Content-Type: application/json" \
  -d '{
    "perguntas": [
      { "tipo": "multipla", "enunciado": "Que padrão delega a criação nas subclasses?",
        "correta": "Factory Method", "opcoes": ["Singleton", "Factory Method", "Observer"] },
      { "tipo": "vf", "enunciado": "O Singleton é um padrão de criação.", "correta": true },
      { "tipo": "curta", "enunciado": "Padrão que notifica observadores?", "correta": "Observer" }
    ],
    "respostas": ["Factory Method", true, " observer "]
  }'
# → {"certas":3,"total":3}
```

## Factory Method

| Papel no padrão     | Classe(s)                                                              |
|---------------------|------------------------------------------------------------------------|
| Produto             | `Pergunta` (`enunciado`, `correta`, `verificar(resposta)`)             |
| Produtos concretos  | `EscolhaMultipla` (com `opcoes`), `VerdadeiroFalso`, `RespostaCurta`   |
| Criador             | `CriadorPergunta` (método fábrica `criarPergunta(dados)`)              |
| Criadores concretos | `CriadorEscolhaMultipla`, `CriadorVerdadeiroFalso`, `CriadorRespostaCurta` |

O registo `registoCriadores` associa os tipos `"multipla"`, `"vf"` e `"curta"`
ao respetivo criador, e `obterCriador(tipo)` lança um `ErroPergunta` se o tipo
for desconhecido. A rota `POST /questionario/corrigir` usa apenas
`obterCriador(tipo).criarPergunta(dados)` e `pergunta.verificar(resposta)`, sem
referir classes concretas. Para acrescentar um tipo novo basta criar a pergunta,
o criador e registá-lo em `perguntas.js`.

Regras de correção:

- **Escolha múltipla:** a resposta tem de ser exatamente a opção correta.
- **Verdadeiro/falso:** aceita `true`/`false` e os textos `"verdadeiro"`, `"falso"`, `"v"`, `"f"`, `"true"`, `"false"`.
- **Resposta curta:** não distingue maiúsculas de minúsculas e ignora todos os espaços.

### Diagramas

Os diagramas estão em PlantUML na pasta `docs/`. Podem ser visualizados com a
extensão PlantUML do VS Code, com o [servidor online do PlantUML](https://www.plantuml.com/plantuml)
ou com `java -jar plantuml.jar docs/*.puml`.

## Publicar no Render

1. Colocar o código num repositório GitHub.
2. Em <https://render.com>, escolher **New → Web Service** e ligar o repositório.
3. Configurar:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Em **Environment**, acrescentar `BASE_URL` com o URL do serviço, por exemplo
   `https://meu-ap.onrender.com` (o Render define `PORT` automaticamente).
5. Criar o serviço. Depois de publicado, testar por exemplo
   `https://meu-ap.onrender.com/json-params`.
6. Na Inven!RA, registar o Activity Provider com os endereços:
   - Configuração: `https://meu-ap.onrender.com/config`
   - Parâmetros: `https://meu-ap.onrender.com/json-params`
   - Deploy: `https://meu-ap.onrender.com/deploy`
   - Lista de analytics: `https://meu-ap.onrender.com/analytics-list`
   - Analytics: `https://meu-ap.onrender.com/analytics`

No plano gratuito, o serviço adormece após algum tempo sem pedidos, pelo que o
primeiro pedido pode demorar alguns segundos.
