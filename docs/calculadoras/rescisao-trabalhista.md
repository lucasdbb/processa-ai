# Calculadora de Rescisão Trabalhista — Método de Cálculo

## Visão Geral

A calculadora de rescisão trabalhista calcula as verbas rescisórias devidas ao empregado quando do encerramento do contrato de trabalho CLT. O cálculo é baseado na CLT, na Lei 12.506/2011 (aviso prévio proporcional) e na Lei 13.467/2017 (Reforma Trabalhista — acordo mútuo, art. 484-A).

**Importante**: O resultado é uma estimativa. O FGTS acumulado é calculado com base na remuneração atual aplicada a todo o período, e não reflete os depósitos reais. Descontos de INSS e IRRF são calculados conforme as tabelas progressivas vigentes em 2026.

---

## 1. Remuneração para Fins Rescisórios

A base de cálculo de todas as verbas é a **remuneração bruta**, composta por:

```
Remuneração = Salário Base
             + Periculosidade (30% do Salário Base)
             + Insalubridade (10%, 20% ou 40% da base de insalubridade)
             + Adicional Noturno ((Salário Base / 220h) × Horas Noturnas × %)
             + Outras Verbas (comissões, gratificações, médias de HE)
```

### Regras dos adicionais
- **Periculosidade**: 30% sobre o salário base (art. 193, §1º CLT)
- **Insalubridade**: percentual sobre a base de insalubridade (por padrão o salário mínimo: R$ 1.621,00 em 2025). Grau mínimo = 10%, médio = 20%, máximo = 40% (art. 192 CLT)
- **Periculosidade e insalubridade são mutuamente exclusivos** (art. 193, §2º CLT)
- **Adicional noturno**: calculado como `(salário / 220h) × média de horas noturnas × percentual`. O padrão legal é 20% para trabalhadores urbanos (art. 73 CLT)

---

## 2. Tipo de Aviso Prévio

O tipo de aviso prévio é selecionado pelo usuário conforme a situação. As opções disponíveis variam por tipo de rescisão:

| Tipo de Aviso | Descrição | Efeito no Cálculo |
|---|---|---|
| **Trabalhado** | Empregado cumpre o período de aviso trabalhando | Empregador paga aviso proporcional ao tempo de serviço. Sem projeção para férias/13º |
| **Indenizado** | Empregador dispensa o empregado de trabalhar o período | Empregador paga aviso proporcional. Tempo é projetado para férias proporcionais, 13º e FGTS rescisório |
| **Dispensado** | Empregador dispensa o aviso sem pagamento | Sem pagamento e sem desconto |
| **Não cumprido** | Empregado pede demissão sem cumprir o aviso | Desconto de 30 dias fixos da rescisão |

### Opções por tipo de rescisão

| Tipo de Rescisão | Opções de Aviso Prévio |
|---|---|
| Sem Justa Causa | Trabalhado, Indenizado, Dispensado |
| Pedido de Demissão | Trabalhado, Não cumprido |
| Com Justa Causa | Dispensado (único) |
| Acordo Mútuo (484-A) | Trabalhado, Indenizado, Dispensado |
| Término de Contrato | Dispensado (único) |

---

## 3. Verbas por Tipo de Rescisão

| Verba | Sem Justa Causa | Pedido de Demissão | Justa Causa | Acordo Mútuo (484-A) | Término de Contrato |
|---|:---:|:---:|:---:|:---:|:---:|
| Saldo de Salário | Sim | Sim | Sim | Sim | Sim |
| Aviso Prévio (a receber) | 100% proporcional | Não¹ | Não | 50% proporcional | Não |
| Férias Vencidas + 1/3 | Sim | Sim | Sim | Sim | Sim |
| Férias Proporcionais + 1/3 | Sim | Sim | Não | Sim | Sim |
| 13º Proporcional | Sim | Sim | Não | Sim | Sim |
| FGTS Rescisório (8%) | Sim | Não | Não | Sim | Sim |
| Multa FGTS | 40% | 0% | 0% | 20% | 0%² |
| Saque FGTS Acumulado | Sim | Não | Não | Sim (80%) | Sim |

> ¹ No pedido de demissão, o empregado deve cumprir aviso prévio de **30 dias fixos** ao empregador (ou ter o valor descontado se não cumprido). A proporcionalidade da Lei 12.506/2011 **não se aplica** em favor do empregador.

> ² Término **normal** de contrato por prazo determinado: não há multa de FGTS. A multa de 40% só seria devida em caso de rescisão antecipada sem justa causa pelo empregador — situação tratada como "Sem Justa Causa".

---

## 4. Fórmulas de Cálculo

### 4.1. Saldo de Salário

Sempre devido, proporcional aos dias trabalhados no mês da rescisão.

```
Saldo de Salário = (Remuneração / 30) × min(30, dia da rescisão)
```

Se a rescisão ocorre no dia 31, considera 30 dias (salário cheio).

### 4.2. Aviso Prévio (Lei 12.506/2011)

O aviso prévio proporcional é calculado assim:

```
Dias de Aviso = 30 + (3 × anos completos de serviço)
Máximo: 90 dias
```

O valor depende do tipo de aviso prévio selecionado:

```
Trabalhado ou Indenizado:
  Valor Aviso = (Remuneração / 30) × Dias de Aviso × Fator
  Fator:
    - Sem justa causa: 1,0
    - Acordo mútuo: 0,5

Dispensado:
  Valor Aviso = 0 (sem pagamento, sem desconto)

Não cumprido (pedido de demissão):
  Valor Aviso = -(Remuneração / 30) × 30  (desconto de 30 dias fixos)
```

### 4.3. Projeção do Aviso Prévio Indenizado

Quando o aviso prévio é **indenizado** (dispensa sem justa causa ou acordo mútuo), o tempo é projetado para cálculo de férias proporcionais, 13º e FGTS rescisório.

```
Meses projetados = Dias de Aviso / 30 (arredonda ≥15 dias para cima)
```

A projeção **só se aplica ao tipo indenizado**. Nos demais tipos (trabalhado, dispensado, não cumprido), não há projeção.

### 4.4. Férias Vencidas + 1/3

Sempre devidas (inclusive na justa causa), proporcionais aos dias de férias vencidas informados pelo usuário.

```
Férias Vencidas = (Remuneração / 30) × Dias de Férias Vencidas × (4/3)
```

O multiplicador `4/3` inclui o terço constitucional (art. 7º, XVII CF).

### 4.5. Férias Proporcionais + 1/3

Calculadas com base no período aquisitivo em curso (meses desde o último aniversário de admissão até a data da rescisão).

```
1. Encontrar a data do último aniversário de admissão antes da rescisão
2. Contar meses desde o aniversário até a rescisão (≥15 dias restantes = +1 mês)
3. Somar meses projetados pelo aviso prévio indenizado (se houver — ver §4.3)
4. Máximo: 12 avos

Férias Proporcionais = (Remuneração / 12) × Meses × (4/3)
```

**Não devidas na justa causa.**

### 4.6. 13º Salário Proporcional

Calculado com base nos meses trabalhados no ano da rescisão (ou desde a admissão, se no mesmo ano).

```
1. Início da contagem = max(1º de janeiro, data de admissão)
2. Contar meses até a rescisão (≥15 dias restantes = +1 mês)
3. Somar meses projetados pelo aviso prévio indenizado (se houver — ver §4.3)
4. Máximo: 12 avos

13º Proporcional = (Remuneração / 12) × Meses
```

**Não devido na justa causa.**

### 4.7. FGTS

#### FGTS Acumulado (estimativa)

Estimativa do saldo na conta vinculada, baseada na remuneração atual. Sempre calculado e exibido, independente do tipo de rescisão:

```
FGTS Acumulado = Remuneração × 8% × Meses Trabalhados (total)
```

> Este valor é apenas informativo. O saldo real depende dos depósitos efetivamente realizados ao longo do contrato. Ele **não entra no total de verbas rescisórias** — é sacado à parte pelo trabalhador via chave FGTS Digital.
>
> **O saque do FGTS acumulado só é possível em determinados tipos de rescisão** (ver tabela na §3). No pedido de demissão e na justa causa, o trabalhador **não** pode sacar o FGTS. No acordo mútuo (art. 484-A), o saque é limitado a 80% do saldo.

#### FGTS Rescisório

O FGTS incide sobre as verbas rescisórias pagas na rescisão. Quando o aviso prévio é negativo (não cumprido), usa-se zero no lugar:

```
FGTS Rescisório = (Saldo de Salário + max(0, Aviso Prévio) + 13º Proporcional) × 8%
```

**Não é devido no pedido de demissão nem na justa causa.**

#### Multa Rescisória do FGTS

Calculada sobre o FGTS total (acumulado + rescisório):

```
Multa FGTS = (FGTS Acumulado + FGTS Rescisório) × Percentual

Percentual:
  - Sem justa causa: 40%
  - Acordo mútuo: 20%
  - Pedido de demissão: 0%
  - Justa causa: 0%
  - Término de contrato (normal): 0%
```

---

## 5. Descontos (INSS e IRRF)

### 5.1. INSS — Tabela Progressiva 2026

Calculado conforme a Portaria Interministerial MPS/MF nº 13/2026, com parcela a deduzir:

| Faixa Salarial | Alíquota | Parcela a Deduzir |
|---|:---:|:---:|
| Até R$ 1.621,00 | 7,5% | R$ 0,00 |
| R$ 1.621,01 a R$ 2.902,84 | 9% | R$ 24,32 |
| R$ 2.902,85 a R$ 4.354,27 | 12% | R$ 111,40 |
| R$ 4.354,28 a R$ 8.475,55 | 14% | R$ 198,49 |

```
INSS = Base × Alíquota - Parcela a Deduzir
Teto de contribuição: R$ 8.475,55
```

#### Incidência do INSS na rescisão

O INSS é calculado em duas parcelas separadas:

```
INSS Verbas = calcular_inss(Saldo de Salário + max(0, Aviso Prévio))
INSS 13º   = calcular_inss(13º Proporcional)
INSS Total = INSS Verbas + INSS 13º
```

> Férias + 1/3 (vencidas e proporcionais) e verbas do FGTS são **isentas** de INSS.

### 5.2. IRRF — Tabela Progressiva Mensal 2026

| Faixa (Base Tributável) | Alíquota | Parcela a Deduzir |
|---|:---:|:---:|
| Até R$ 2.428,80 | Isento | — |
| R$ 2.428,81 a R$ 2.826,65 | 7,5% | R$ 182,16 |
| R$ 2.826,66 a R$ 3.751,05 | 15% | R$ 394,16 |
| R$ 3.751,06 a R$ 4.664,68 | 22,5% | R$ 675,49 |
| Acima de R$ 4.664,68 | 27,5% | R$ 908,73 |

#### Incidência do IRRF na rescisão

O IRRF é calculado sobre a base tributável (após dedução do INSS), em duas parcelas separadas:

```
Base IRRF Verbas = (Saldo de Salário + max(0, Aviso Prévio)) - INSS Verbas
IRRF Verbas = calcular_irrf(Base IRRF Verbas)

Base IRRF 13º = 13º Proporcional - INSS 13º
IRRF 13º = calcular_irrf(Base IRRF 13º)

IRRF Total = IRRF Verbas + IRRF 13º
```

> Férias + 1/3 (vencidas e proporcionais), FGTS rescisório e multa do FGTS são **isentos** de IRRF.

---

## 6. Total Líquido

O total representa as **verbas rescisórias líquidas** pagas diretamente ao trabalhador, sem incluir o FGTS acumulado (que é sacado separadamente):

```
Total Bruto = Saldo de Salário
            + Aviso Prévio
            + Férias Vencidas + 1/3
            + Férias Proporcionais + 1/3
            + 13º Proporcional
            + FGTS Rescisório
            + Multa FGTS

Total Descontos = INSS Total + IRRF Total

Total Líquido = Total Bruto - Total Descontos
```

---

## 7. Limitações e Observações

1. **FGTS acumulado é estimativa**: usa a remuneração atual multiplicada pelo período todo. O valor real depende dos depósitos efetuados mensalmente.
2. **Hora noturna reduzida**: assume que o valor de "média de horas noturnas" já considera a hora reduzida (52min30s = 1h noturna) ou é hora relógio.
3. **Férias vencidas**: o usuário informa manualmente o número de dias de férias vencidas.
4. **Término de contrato**: trata como encerramento **normal** de contrato por prazo determinado — sem aviso prévio e sem multa de FGTS. Se a rescisão for antecipada pelo empregador, usar "Sem Justa Causa".
5. **Pedido de demissão**: o tipo de aviso prévio determina se haverá desconto. Se "trabalhado", o empregado cumpre o período sem desconto. Se "não cumprido", há desconto de 30 dias fixos (a proporcionalidade da Lei 12.506/2011 não se aplica em favor do empregador).
6. **Saque FGTS no acordo mútuo**: a legislação limita o saque a 80% do saldo acumulado. A calculadora exibe o valor total estimado — o trabalhador deve aplicar o limite de 80% sobre o saldo real.
7. **INSS e IRRF**: calculados conforme tabelas progressivas vigentes em 2026. Férias + 1/3 e verbas indenizatórias são isentas de tributação.

---

## 8. Referências Legais

- **CLT** (Decreto-Lei 5.452/1943) — arts. 73, 192, 193, 457, 477, 478, 487
- **Lei 12.506/2011** — Aviso prévio proporcional ao tempo de serviço
- **Lei 13.467/2017** (Reforma Trabalhista) — art. 484-A (rescisão por acordo mútuo)
- **Lei 8.036/1990** — FGTS (art. 18: multa de 40%; art. 20: hipóteses de saque)
- **Constituição Federal** — art. 7º, XVII (terço de férias), XXI (aviso prévio proporcional)
- **Portaria Interministerial MPS/MF nº 13/2026** — Tabelas de INSS e IRRF
- **Salário Mínimo 2025**: R$ 1.621,00 (Decreto 12.797/2025)
