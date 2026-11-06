# Regras Modeladas — Buraco Aberto (4 Jogadores, 2 Duplas)

> Documento de referência para o motor de regras.
> Regras fechadas com a família. Duas premissas finais para conferir na seção 12.
> O engine só será gerado depois da aprovação final deste documento.

---

## 1. ESTRUTURA DO JOGO

### 1.1 Jogadores e duplas
- 4 jogadores sentados alternados: J0, J1, J2, J3
- Dupla A: J0 + J2 (posições opostas)
- Dupla B: J1 + J3 (posições opostas)

### 1.2 Baralhos
- 2 baralhos de 52 cartas = **104 cartas**
- Sem coringas (Jokers)

### 1.3 Valores das cartas
| Carta | Pontos |
|-------|--------|
| Ás | 15 |
| K, Q, J, 10, 9, 8 | 10 |
| 2 | 10 |
| 7, 6, 5, 4, 3 | 5 |

---

## 2. SETUP INICIAL

1. Embaralhar as 104 cartas
2. Distribuir **11 cartas** para cada jogador (44 cartas)
3. Separar **2 mortos** de **11 cartas** cada (22 cartas), ao centro da mesa. **Os mortos não têm dono**: ficam de quem esvaziar a mão primeiro
4. O restante forma o **monte** (104 - 44 - 22 = 38 cartas)
5. O **lixo começa vazio**

---

## 3. TURNO DO JOGADOR

```
1. COMPRAR  →  2. (opcional) BAIXAR / ADICIONAR  →  3. DESCARTAR
```

Cada etapa tem limite de tempo (seção 10).

### 3.1 Comprar
- **Do monte**: 1 carta do topo
- **Do lixo**: todas as cartas do lixo vão para a mão. Não há exigência de usar a carta do topo.

### 3.2 Baixar e adicionar (opcional)
- **Novo jogo**: só com 3 ou mais cartas de uma vez, em sequência do mesmo naipe (seção 4)
- **Adicionar a jogo já batizado**: pode descer **1 carta por vez** nos jogos da dupla
- **Nenhuma carta baixada pode ser retirada** de um jogo

### 3.3 Descartar
- O turno termina com o descarte de 1 carta no lixo
- Exceção: quando o jogador bate (seção 7)

### 3.4 Regra da última carta
O jogador **não pode executar uma ação** (baixar, adicionar ou descartar) que o deixe **sem cartas na mão**, a menos que isso resulte em **pegar o morto** (seção 6) ou em **bater** (seção 7).

Na prática, o jogador precisa manter ao menos 1 carta quando:
- a dupla já pegou o morto e não tem canastra limpa; ou
- a dupla não tem mais morto (ele virou monte, seção 6.3).

---

## 4. JOGOS

> O termo é **jogo**. Não existe trinca (cartas iguais de naipes diferentes).

### 4.1 Definição
Um jogo é uma **sequência de 3 ou mais cartas do mesmo naipe**, em ordem crescente.

- O **Ás vale como baixo e como alto**: A-2-3 e Q-K-A são válidos
- A sequência **não dá a volta**: K-A-2 é inválida
- Tamanho máximo: **14 cartas** (A, 2, 3 ... K, A)
- **Jogos não se unem**: jogos baixados separadamente continuam separados, mesmo do mesmo naipe e com ranks vizinhos

Exemplos:
- ✅ 5♠ 6♠ 7♠
- ✅ Q♥ K♥ A♥
- ❌ 5♠ 6♥ 7♠ (naipes diferentes)
- ❌ 7♠ 7♥ 7♦ (trinca não existe)
- ❌ K♠ A♠ 3♠ (não dá a volta)
- ✅ K♠ A♠ 2♠ (o 2 é coringa no lugar da Dama: Q-K-A)

### 4.2 O 2
- **2 do mesmo naipe do jogo, na posição natural** (logo depois do Ás, ou no início do jogo quando não há Ás): é carta normal, vale seu valor
- **2 em qualquer outra posição, ou de outro naipe**: é **coringa** e substitui qualquer carta
- Limite: **1 coringa por jogo**
- Um jogo pode ter **dois 2**: um na posição natural e outro como coringa
- Um jogo com coringa é **sujo**. Sem coringa, é **limpo**

### 4.3 Reposicionar o coringa
- O 2 coringa **nunca sai do jogo** onde foi baixado
- Quando o jogador adiciona a carta real que o coringa representava, o 2 pode ser **reposicionado dentro do mesmo jogo**
- Se o 2 chegar à posição natural, o jogo deixa de ter coringa e passa a ser **limpo**
- A condição limpo/sujo vale pelo estado do jogo no momento da pontuação

---

## 5. CANASTRAS

Canastra é um **jogo com 7 ou mais cartas**.

| Tipo | Descrição | Bônus |
|------|-----------|-------|
| Canastra Limpa | 7+ cartas, sem coringa | **+200** |
| Canastra Suja | 7+ cartas, com 1 coringa | **+100** |
| Canastra de 13 | A→K **ou** 2→A, do mesmo naipe, limpa (13 cartas) | **+500** (no lugar dos 200) |
| Canastra A→A | A, 2, 3 ... K, A do mesmo naipe, limpa (14 cartas) | **+1.000** (no lugar dos 200) |

> As canastras de 13 e 14 cartas devem ser limpas, sem nenhum 2 coringa.

---

## 6. MORTO E FIM DO MONTE

### 6.1 Regras gerais
- São **2 mortos** (11 cartas cada), sem dono definido. Quem pega primeiro fica com um; a outra dupla, se esvaziar depois, pega o que sobrou
- O morto é pego quando um jogador da dupla **fica sem cartas na mão**
- **Não há nenhuma exigência** para pegar o morto
- Cada dupla só pode pegar **1 morto**, e só enquanto ainda houver morto na mesa

### 6.2 Como o jogador fica sem cartas
| Situação | O que acontece |
|----------|----------------|
| **Em pé** (baixou tudo, sem descartar) | Pega o morto e **continua o turno**: pode baixar, adicionar e até bater de novo. Ao final, precisa descartar para encerrar o turno (a menos que bata). O relógio de 40s **reinicia** (seção 10.4) |
| **Descartando** a última carta | Pega o morto, mas só joga a partir do **próximo turno** |

### 6.3 Monte acabou
1. Se houver morto ainda não pego, suas 11 cartas viram o **novo monte**
2. Se os **dois mortos** estiverem disponíveis, **um é sorteado** aleatoriamente
3. Como o morto não tem dono, ninguém perde nada na hora: **quem terminar a rodada sem ter pego um morto leva -100** (seção 8.2) e, sem morto, não consegue bater (seção 7.1). A dupla que ainda não pegou pode pegar o morto que restou, se esvaziar a mão antes
4. Se o novo monte acabar e ainda restar o outro morto, ele vira monte também. Nesse cenário, **nenhuma dupla pegou morto, então as duas perdem 100**
5. Se o monte acabar e **não houver mais morto** para virar monte, a **rodada termina** (a partida segue até 3.000, seção 8.4). O placar é calculado como na seção 8: canastras, cartas nos jogos, cartas na mão como negativo e -100 para quem não pegou o morto.

---

## 7. BATIDA (fim da rodada)

### 7.1 Condições para bater
1. A dupla já **pegou o morto**
2. A dupla tem **pelo menos 1 canastra limpa** na mesa
3. O jogador fica sem cartas na mão

### 7.2 Bônus
**+100 pontos** para a dupla que bate. Quando a rodada acaba por falta de monte (sem batida), ninguém recebe esse bônus.

### 7.3 O que acontece ao bater
1. A rodada encerra imediatamente
2. Todas as cartas restantes nas mãos contam como pontos negativos
3. Calcula-se o placar da rodada (seção 8)

---

## 8. PONTUAÇÃO

### 8.1 Positivos (cada dupla)
- Soma dos valores das cartas dos jogos na mesa
- Bônus de canastras (seção 5)
- Bônus de batida: +100 (seção 7.2)

### 8.2 Negativos (cada dupla)
- Soma dos valores das cartas que ficaram na mão dos dois jogadores da dupla
- **-100** se a dupla não pegou o morto (inclui o morto que virou monte)

### 8.3 Fórmula
```
Placar da rodada = (cartas nos jogos) + (bônus de canastras) + (100 se bateu)
                   - (cartas na mão) - (100 se não pegou o morto)
```

### 8.4 Vitória
- A partida termina quando uma dupla atingir **3.000 pontos** acumulados
- Se as duas duplas passarem de 3.000 na mesma rodada, **vence a de maior pontuação**

---

## 9. ESTADOS DO JOGO (para o código)

```
WAITING_TURN     → vez do jogador; janela de 20s para comprar
PLAYING          → comprou; janela de 40s para baixar, adicionar e descartar
ROUND_OVER       → alguém bateu, ou o monte acabou sem morto; calculando pontos
GAME_OVER        → uma dupla atingiu 3.000

EVENTOS:
MORTO_EM_PE      → esvaziou a mão sem descartar: pega o morto, segue em PLAYING (relógio de 40s reinicia)
MORTO_DESCARTE   → esvaziou a mão descartando: pega o morto, turno encerra
MORTO_VIRA_MONTE → monte acabou: um morto não pego (sorteado, se houver dois) vira o novo monte
BATIDA           → condições da seção 7.1 cumpridas
TIMEOUT_COMPRA   → 20s esgotados: compra automática
TIMEOUT_JOGADA   → 40s esgotados: descarte automático
```

---

## 10. TEMPO DE JOGADA E AÇÕES AUTOMÁTICAS

> **O relógio é opcional e vem DESLIGADO por padrão** (decisão de 06/11/2026: a internet instável travava as partidas). As regras desta seção só valem quando o tempo é ligado na configuração (`drawSeconds` / `playSeconds`).

### 10.1 Limites
| Etapa | Tempo | O que o jogador precisa fazer |
|-------|-------|-------------------------------|
| Compra | **20 segundos** | Comprar do monte ou pegar o lixo |
| Jogadas | **40 segundos** (começam após a compra) | Baixar, adicionar e descartar |

### 10.2 Estouro dos 20s: compra automática
A aplicação compra pelo jogador, olhando **somente a carta do topo** do lixo:
- **Pega o lixo** se a carta do topo puder ser **adicionada a um jogo já baixado** da dupla, ou **formar um jogo novo** com cartas da mão do jogador
- **Caso contrário, compra do monte**

Ao pegar o lixo, o jogador leva **todas as cartas** dele (seção 3.1). As demais cartas do lixo não entram na checagem.

### 10.3 Estouro dos 40s: descarte automático
A aplicação descarta uma carta e passa a vez. Escolha da carta:
1. A de **menor pontuação** que **não esteja em sequência na mão** do jogador
2. Se não houver essa carta, a **menor carta da mão**

**O que conta como "em sequência na mão":** a carta tem na mão outra carta do **mesmo naipe com rank vizinho** (ex.: 5♠ protege o 6♠ e o 4♠). O Ás é vizinho do 2 e do K.

**Desempate** (mesma pontuação): descarta a de **menor rank** (ex.: 3 antes do 7). O 2 fica por último no desempate, por ser coringa. Persistindo o empate, qualquer uma.

> As jogadas já feitas dentro dos 40s permanecem. Só o descarte é automático.

### 10.4 Relógio e morto em pé
Quando o jogador pega o morto em pé e continua o turno, o relógio de **40s reinicia**.

---

## 11. CASOS ESPECIAIS

| Situação | Regra |
|----------|-------|
| Lixo vazio | Só é possível comprar do monte |
| Dupla tenta bater sem ter pego o morto | Inválido |
| Dupla tenta bater sem canastra limpa | Inválido |
| Dupla tenta pegar um segundo morto | Inválido |
| Os dois mortos já foram pegos | Quem esvaziar a mão depois cai na regra da última carta (seção 3.4) |
| Ação deixaria o jogador sem cartas, sem pegar morto nem bater | Impedida (seção 3.4) |
| Retirar carta já baixada | Inválido |
| Unir dois jogos | Inválido |
| 2♠ entre A♠ e 3♠ num jogo de espadas | Carta normal; o jogo continua limpo |
| 2♥ num jogo de espadas | Sempre coringa |
| Segundo coringa no mesmo jogo | Inválido |
| Jogo A→A com algum 2 coringa | Canastra suja comum (+100) |
| Canastra 2→A limpa (13 cartas) | +500, igual à A→K |
| Monte acaba com dois mortos disponíveis | Sorteia um deles para virar monte |
| Monte acaba sem morto disponível | Rodada termina e soma os pontos (seção 6.3) |
| Compra automática, lixo vazio | Compra do monte |

---

## 12. PREMISSAS PARA CONFERIR

Não há pontos em aberto. Ao fechar o documento, assumi duas coisas que você não disse explicitamente:

1. **Compra automática, jogo novo com a mão:** a checagem usa as cartas que o jogador já tem na mão **antes** de pegar o lixo (mais a carta do topo).
2. **Desempate no descarte automático:** o 2 é o último a ser descartado entre cartas de mesma pontuação, por ser coringa.

---

## 13. PAUSA E ENCERRAMENTO ANTECIPADO

- **Pausar:** qualquer um dos 4 jogadores pausa a partida. Enquanto estiver pausada, ninguém joga; qualquer jogador pode continuar. Se o relógio estiver ligado, ele não corre durante a pausa.
- **Encerrar a partida antes da meta:** qualquer jogador **propõe**; os **4 precisam aceitar**. Um "recusar" cancela a proposta. O administrador da mesa (criador ou Master) pode encerrar na hora.
- **Placar do encerramento:** vale o placar acumulado das rodadas já terminadas (a rodada em andamento **não** conta). Vence a dupla com mais pontos; se igual, empate.
- **Adicionar várias cartas:** é possível selecionar várias cartas e tocar num jogo da dupla. Elas entram **uma por vez**, na ordem em que encaixarem; se alguma não encaixar, nenhuma é aplicada.
