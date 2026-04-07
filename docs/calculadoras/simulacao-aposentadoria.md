# Simulação de Aposentadoria — Método de Cálculo

## Visão Geral

A simulação de aposentadoria é a calculadora principal do módulo previdenciário. Ela avalia **6 cenários de aposentadoria** (1 regra permanente + 4 regras de transição + direito adquirido) conforme a EC 103/2019, determinando elegibilidade, data projetada e benefício estimado para cada um.

Internamente, a simulação orquestra as 3 calculadoras auxiliares:

1. **[Tempo de Contribuição](tempo-contribuicao.md)** — totaliza o período contributivo
2. **[Média Salarial](media-salarial.md)** — calcula a média das contribuições com correção INPC
3. **[Fator Previdenciário](fator-previdenciario.md)** — aplica a fórmula atuarial (Lei 9.876/1999)

**Base legal**: EC 103/2019, Lei 8.213/1991, Lei 9.876/1999, Lei 13.183/2015.

---

## 1. Dados de Entrada

### 1.1. Dados do Segurado

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `data_nascimento` | date | Sim | Data de nascimento |
| `sexo` | "M" ou "F" | Sim | Sexo |
| `professor` | bool | Não | Professor da educação básica |

### 1.2. Vínculos e Remunerações

Ver [Tempo de Contribuição](tempo-contribuicao.md#1-dados-de-entrada) e [Média Salarial](media-salarial.md#1-dados-de-entrada).

### 1.3. Parâmetros adicionais

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `indices_inpc` | dict | null | Mapa competência → fator INPC |
| `tabua_mortalidade` | dict | null | Mapa idade → expectativa de sobrevida (IBGE) |
| `teto_inss` | Decimal | R$ 8.475,55 | Teto do INSS vigente |
| `piso_inss` | Decimal | R$ 1.621,00 | Piso (salário mínimo) vigente |
| `salario_contribuicao_futuro` | Decimal | null | Salário para projeção futura (ver §8) |

---

## 2. Etapas de Processamento

A simulação executa as seguintes etapas em sequência:

```
1. Calcular tempo de contribuição atual (ver tempo-contribuicao.md)
2. Calcular tempo de contribuição na data da reforma (13/11/2019)
3. Calcular média salarial (ver media-salarial.md)
4. Calcular fator previdenciário (ver fator-previdenciario.md)
5. Avaliar os 6 cenários de aposentadoria
6. Determinar o melhor cenário
7. Calcular projeção futura (se salário futuro informado)
```

### Etapa 2 — Tempo na data da reforma

A calculadora de tempo de contribuição é executada com `data_referencia = 13/11/2019`, tratando vínculos abertos como ativos até a reforma. Este valor é essencial para os cenários de Pedágio 50%, Pedágio 100% e Direito Adquirido.

### Etapa 4 — Fator previdenciário

Só é calculado se a tábua de mortalidade estiver disponível. Usa a idade atual do segurado e o tempo de contribuição atual. Ver [Fator Previdenciário](fator-previdenciario.md) para a fórmula completa.

---

## 3. Coeficiente de Benefício Pós-Reforma

A EC 103/2019 introduziu um coeficiente que substitui o fator previdenciário nas regras pós-reforma:

```
Coeficiente = 60% + 2% × max(0, anos_contribuição - limiar)

Limiar:
  Homem: 20 anos
  Mulher: 15 anos
```

### Exemplos

| Sexo | Tempo de contribuição | Coeficiente |
|:---:|:---:|:---:|
| M | 15 anos | 60% (abaixo do limiar) |
| M | 20 anos | 60% (no limiar) |
| M | 30 anos | 80% (20 + 10 excedentes × 2%) |
| M | 40 anos | 100% |
| F | 15 anos | 60% (no limiar) |
| F | 25 anos | 80% (15 + 10 excedentes × 2%) |
| F | 35 anos | 100% |

O coeficiente pode ultrapassar 100% — não há cap superior.

---

## 4. Cálculo do Benefício

```
Benefício = Média Salarial × Coeficiente (ou Fator)
Benefício final = max(piso, min(Benefício, teto))
```

O benefício é sempre limitado entre o piso (salário mínimo) e o teto do INSS.

---

## 5. Os 6 Cenários

### 5.1. Regra Permanente (Art. 201, §7°, CF)

Regra definitiva da EC 103/2019. Requisitos simultâneos:

| Requisito | Homem | Mulher | Professor(M) | Professora(F) |
|---|:---:|:---:|:---:|:---:|
| Idade mínima | 65 | 62 | 60 | 57 |
| Contribuição mínima | 15 | 15 | 25 | 25 |

**Benefício**: Média 100% × coeficiente pós-reforma (§3).

### 5.2. Regra de Pontos (Art. 15)

Idade + tempo de contribuição >= pontos mínimos do ano. Progressão de **+1 ponto/ano**:

| Ano | Homem | Mulher | Professor(M) | Professora(F) |
|:---:|:---:|:---:|:---:|:---:|
| 2019 | 96 | 86 | 92 | 82 |
| 2020 | 97 | 87 | 93 | 83 |
| ... | +1/ano | +1/ano | +1/ano | +1/ano |
| Cap | 105 | 100 | 100 | 92 |

Contribuição mínima: M=35, F=30 (Professor: 25 ambos).

**Benefício**: Média 100% × coeficiente pós-reforma.

### 5.3. Idade Mínima Progressiva (Art. 16)

Idade mínima progressiva de **+6 meses/ano**:

| Ano | Homem | Mulher | Professor(M) | Professora(F) |
|:---:|:---:|:---:|:---:|:---:|
| 2019 | 61,0 | 56,0 | 56,0 | 51,0 |
| 2020 | 61,5 | 56,5 | 56,5 | 51,5 |
| ... | +0,5/ano | +0,5/ano | +0,5/ano | +0,5/ano |
| Cap | 65,0 | 62,0 | 60,0 | 57,0 |

Contribuição mínima: M=35, F=30 (Professor: 25 ambos).

**Benefício**: Média 100% × coeficiente pós-reforma.

### 5.4. Pedágio 50% (Art. 17)

Disponível **apenas** para quem faltava até **2 anos** de contribuição em 13/11/2019. Não se aplica a professores.

```
Tempo necessário = contribuição_mínima + (faltava × 50%)

contribuição_mínima: M=35, F=30
faltava = max(0, contribuição_mínima - tempo_na_reforma)
```

| Requisito | Regra |
|---|---|
| Elegibilidade | faltava <= 2 anos em 13/11/2019 |
| Tempo total | contribuição_mínima + 50% do que faltava |
| Idade | Sem requisito de idade |

**Benefício**: Média 100% × **fator previdenciário** (obrigatório). Ver [Fator Previdenciário](fator-previdenciario.md).

### 5.5. Pedágio 100% (Art. 20)

Exige idade mínima + tempo de contribuição com pedágio de 100% sobre o que faltava na reforma:

```
Tempo necessário = contribuição_mínima + faltava
faltava = max(0, contribuição_mínima - tempo_na_reforma)
```

| Requisito | Homem | Mulher | Professor(M) | Professora(F) |
|---|:---:|:---:|:---:|:---:|
| Idade mínima | 60 | 57 | 55 | 52 |
| Contribuição mínima | 35 | 30 | 25 | 25 |

**Benefício**: **100% da média** (sem coeficiente redutor — a mais vantajosa entre as regras de transição).

### 5.6. Direito Adquirido (Regras pré-reforma)

Para segurados que **já cumpriam** todos os requisitos antes de 13/11/2019. Três vias possíveis:

#### a) Aposentadoria por tempo de contribuição

| Requisito | Homem | Mulher | Professor(M) | Professora(F) |
|---|:---:|:---:|:---:|:---:|
| Contribuição | 35 | 30 | 30 | 25 |
| Idade | Sem requisito | Sem requisito | Sem requisito | Sem requisito |

**Benefício**: Média 80% × fator previdenciário.

#### b) Regra 85/95 pontos (Lei 13.183/2015)

Se cumpriu tempo de contribuição E atingiu os pontos na data da reforma (2019: M=96, F=86; Professor: M=91, F=81):

**Benefício**: **100% da média 80%** (sem fator previdenciário).

#### c) Aposentadoria por idade (pré-reforma) — não se aplica a professores

| Requisito | Homem | Mulher |
|---|:---:|:---:|
| Idade | 65 | 60 |
| Carência | 15 anos | 15 anos |

**Benefício**: Média 80% × (70% + 1% por ano de contribuição).

---

## 6. Projeção de Data de Elegibilidade

Para cenários não elegíveis, a simulação projeta mês a mês até encontrar a data em que todos os requisitos serão cumpridos:

```
data = hoje
Enquanto data <= hoje + 40 anos:
  Se todos os requisitos são cumpridos em data:
    retornar data
  data += 1 mês
```

A projeção assume que vínculos abertos continuam ativos e usa a função `calcular_tempo_na_data()` do módulo de [Tempo de Contribuição](tempo-contribuicao.md#9-projeção-futura) para recalcular o tempo em cada data.

---

## 7. Determinação do Melhor Cenário

O algoritmo prioriza:

1. **Cenários elegíveis**: seleciona o com **maior benefício estimado**
2. **Se nenhum é elegível**: seleciona o com **data de elegibilidade mais próxima**

---

## 8. Projeção Futura e Recomendação

Quando o usuário informa o `salario_contribuicao_futuro` (pré-preenchido com a média das últimas 12 remunerações), a simulação gera uma análise comparativa dos cenários futuros.

### 8.1. Lógica

Para cada cenário **não elegível** com data de elegibilidade (exceto Direito Adquirido):

```
1. meses_restantes = diferença em meses entre hoje e data_elegibilidade
2. tempo_projetado = tempo_atual + meses_restantes/12 (em anos decimais)
3. Recalcular coeficiente/fator com o tempo projetado
4. beneficio_projetado = media × coeficiente_projetado (limitado piso/teto)
```

### 8.2. Coeficiente projetado por regra

| Regra | Coeficiente na data futura |
|---|---|
| Permanente, Pontos, Idade Progressiva | `60% + 2% × max(0, tempo_projetado - limiar)` |
| Pedágio 50% | Fator previdenciário recalculado com idade e tempo futuros |
| Pedágio 100% | 1,0 (100% da média) |
| Direito Adquirido | Não se projeta |

Para o Pedágio 50%, o fator previdenciário é recalculado na data de elegibilidade usando a idade futura e a expectativa de sobrevida correspondente da tábua IBGE.

### 8.3. Seleção de cenários

- **Cenário mais próximo**: menor `meses_restantes`
- **Cenário mais vantajoso**: maior `beneficio_projetado` (se diferente do mais próximo)
- **Ganho mensal**: diferença de benefício entre o mais vantajoso e o mais próximo

### 8.4. Texto de recomendação

A simulação gera um texto em português natural com base em 3 casos:

**Caso 1 — Já elegível, mas cenário futuro é melhor:**
> "Você já pode se aposentar pela Regra Permanente com benefício de R$ 2.880/mês. Porém, se continuar contribuindo por mais 12 meses com salário de R$ 4.500, atingirá a Regra de Pontos com benefício de R$ 3.240/mês (coeficiente 72%) — um ganho de R$ 360/mês."

**Caso 2 — Nenhum cenário elegível hoje:**
> "Continuando a contribuir com salário de R$ 4.500, a regra mais próxima é Idade Mínima Progressiva em out/2027 (18 meses), com benefício projetado de R$ 3.840/mês (coeficiente 72%). Se esperar mais 24 meses, poderá usar o Pedágio 100% com benefício de R$ 4.500/mês (coeficiente 100%) — um ganho de R$ 660/mês."

**Caso 3 — Mais próximo e mais vantajoso são o mesmo:**
> "Continuando a contribuir com salário de R$ 3.000, a melhor opção é a Regra de Pontos em mar/2028 (24 meses), com benefício projetado de R$ 2.760/mês (coeficiente 68%)."

---

## 9. Regras de Professor

Quando `professor = true`, os seguintes ajustes são aplicados automaticamente:

| Item | Comum | Professor |
|---|---|---|
| Idade Permanente (M/F) | 65 / 62 | 60 / 57 |
| Contribuição Permanente | M=15, F=15 | 25 (ambos) |
| Pontos base 2019 (M/F) | 96 / 86 | 92 / 82 |
| Pontos cap (M/F) | 105 / 100 | 100 / 92 |
| Idade Progressiva base (M/F) | 61 / 56 | 56 / 51 |
| Idade Progressiva cap (M/F) | 65 / 62 | 60 / 57 |
| Contribuição mínima (transição) | M=35, F=30 | 25 (ambos) |
| Pedágio 50% | Aplicável | **Não se aplica** |
| Pedágio 100% idade (M/F) | 60 / 57 | 55 / 52 |
| Pedágio 100% contribuição | M=35, F=30 | 25 (ambos) |
| Dir. Adquirido tempo (M/F) | 35 / 30 | 30 / 25 |
| Dir. Adquirido pontos 2019 (M/F) | 96 / 86 | 91 / 81 |

Um alerta é adicionado ao resultado quando regras de professor são aplicadas.

---

## 10. Resultado

| Campo | Tipo | Descrição |
|---|---|---|
| `segurado` | DadosSegurado | Dados pessoais do segurado |
| `tempo_contribuicao` | TempoContribuicao | Resultado do [cálculo de tempo](tempo-contribuicao.md) |
| `media_salarial` | MediaSalarial | Resultado do [cálculo de média](media-salarial.md) |
| `cenarios` | list[CenarioAposentadoria] | 6 cenários avaliados |
| `melhor_cenario` | RegraAposentadoria | Identificação do melhor cenário |
| `alertas` | list[string] | Alertas (professor, sobreposições, vínculos abertos, etc.) |
| `projecao` | ProjecaoFutura | Projeção futura com recomendação (se solicitada) |

### Estrutura de cada cenário

| Campo | Tipo | Descrição |
|---|---|---|
| `regra` | enum | permanente, pontos, idade_progressiva, pedagio_50, pedagio_100, direito_adquirido |
| `regra_nome` | string | Nome legível da regra |
| `elegivel` | bool | Se cumpre todos os requisitos hoje |
| `data_elegibilidade` | date | Data atual (se elegível) ou data projetada |
| `beneficio_estimado` | Decimal | Benefício mensal estimado |
| `coeficiente` | float | Coeficiente aplicado (pós-reforma) |
| `fator_previdenciario` | float | Fator previdenciário (quando aplicável) |
| `requisitos_faltantes` | list[string] | Requisitos ainda não cumpridos |

### Estrutura da projeção futura

| Campo | Tipo | Descrição |
|---|---|---|
| `salario_contribuicao` | Decimal | Salário utilizado na projeção |
| `cenario_mais_proximo` | CenarioProjetado | Cenário futuro mais próximo |
| `cenario_mais_vantajoso` | CenarioProjetado | Cenário futuro com maior benefício |
| `ganho_mensal_esperar` | Decimal | Diferença de benefício entre vantajoso e próximo |
| `recomendacao` | string | Texto de recomendação em português |

---

## 11. Limitações e Observações

1. **Média salarial simplificada na projeção**: A projeção futura utiliza a média salarial atual como base. As novas contribuições ao `salario_contribuicao_futuro` diluem pouco em 20+ anos de histórico, tornando a simplificação aceitável.
2. **Tábua de mortalidade**: Sem a tábua IBGE, o fator previdenciário e a projeção do Pedágio 50% ficam imprecisos. A tábua é carregada do banco de dados pelo worker.
3. **Índices INPC**: Sem os índices, a média salarial é calculada com valores nominais (sem correção monetária). Isso subestima contribuições antigas.
4. **Projeção de 40 anos**: O limite de projeção é de 40 anos. Cenários que requerem mais tempo retornam `data_elegibilidade = null`.
5. **Pedágio 50% e professores**: O Pedágio 50% não se aplica a professores na implementação atual, pois o Art. 17 da EC 103/2019 não prevê redução para a categoria.
6. **CNIS como fonte**: A extração do CNIS é determinística (sem IA), mas irregularidades no PDF podem gerar dados imprecisos. O usuário deve conferir os dados importados.

---

## 12. Referências Legais

- **EC 103/2019** — Reforma da Previdência
  - Art. 15: Regra de Pontos
  - Art. 16: Idade Mínima Progressiva (§1°: professores)
  - Art. 17: Pedágio 50%
  - Art. 20: Pedágio 100% (§1°: professores)
  - Art. 26: Cálculo do benefício (100% das contribuições)
- **CF/1988** — Art. 201, §7° e §8° (aposentadoria, professores)
- **Lei 8.213/1991** — Plano de Benefícios da Previdência Social
- **Lei 9.876/1999** — Fator previdenciário
- **Lei 13.183/2015** — Regra 85/95 progressiva
- **Decreto 3.048/1999** — Regulamento da Previdência Social
- **IBGE** — Tábua Completa de Mortalidade (publicação anual)
