# Calculadora de Rescisão Trabalhista — Método de Cálculo

## Visão Geral

A calculadora de rescisão trabalhista calcula as verbas rescisórias devidas ao empregado quando do encerramento do contrato de trabalho CLT. O cálculo é baseado na CLT, na Lei 12.506/2011 (aviso prévio proporcional) e na Lei 13.467/2017 (Reforma Trabalhista — acordo mútuo, art. 484-A).

**Importante**: O resultado é uma estimativa. O FGTS acumulado é calculado com base na remuneração atual aplicada a todo o período, e não reflete os depósitos reais. Descontos de INSS e IRRF não são aplicados — o resultado é bruto.

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

## 2. Verbas por Tipo de Rescisão

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

> ¹ No pedido de demissão, o empregado deve cumprir aviso prévio de **30 dias fixos** ao empregador (ou ter o valor descontado). A proporcionalidade da Lei 12.506/2011 **não se aplica** em favor do empregador. A calculadora não inclui o aviso prévio como verba a receber neste caso.

> ² Término **normal** de contrato por prazo determinado: não há multa de FGTS. A multa de 40% só seria devida em caso de rescisão antecipada sem justa causa pelo empregador — situação tratada como "Sem Justa Causa".

---

## 3. Fórmulas de Cálculo

### 3.1. Saldo de Salário

Sempre devido, proporcional aos dias trabalhados no mês da rescisão.

```
Saldo de Salário = (Remuneração / 30) × min(30, dia da rescisão)
```

Se a rescisão ocorre no dia 31, considera 30 dias (salário cheio).

### 3.2. Aviso Prévio (Lei 12.506/2011)

O aviso prévio proporcional é calculado assim:

```
Dias de Aviso = 30 + (3 × anos completos de serviço)
Máximo: 90 dias
```

O valor depende do tipo de rescisão:

```
Valor Aviso = (Remuneração / 30) × Dias de Aviso × Fator

Fator:
  - Sem justa causa: 1,0 (proporcional)
  - Acordo mútuo: 0,5 (proporcional)
  - Pedido de demissão: 0 (não recebe aviso — deve ao empregador)
  - Justa causa: 0 (não tem aviso)
  - Término de contrato: 0 (não tem aviso)
```

**Pedido de demissão**: o empregado que pede demissão não tem direito a receber aviso prévio. Pelo contrário, ele deve cumprir 30 dias de aviso ao empregador (sempre 30 dias fixos — a proporcionalidade da Lei 12.506/2011 é benefício exclusivo do empregado dispensado). Se o empregador dispensar o cumprimento, não há desconto.

### 3.3. Projeção do Aviso Prévio Indenizado

Quando o aviso prévio é indenizado **em favor do empregado** (dispensa sem justa causa ou acordo mútuo), o tempo é projetado para cálculo de férias proporcionais, 13º e FGTS rescisório.

```
Meses projetados = Dias de Aviso / 30 (arredonda ≥15 dias para cima)
```

**Não se aplica ao pedido de demissão** (o aviso é do empregado para o empregador, não gera projeção em favor do empregado).

### 3.4. Férias Vencidas + 1/3

Sempre devidas (inclusive na justa causa), proporcionais aos dias de férias vencidas informados pelo usuário.

```
Férias Vencidas = (Remuneração / 30) × Dias de Férias Vencidas × (4/3)
```

O multiplicador `4/3` inclui o terço constitucional (art. 7º, XVII CF).

### 3.5. Férias Proporcionais + 1/3

Calculadas com base no período aquisitivo em curso (meses desde o último aniversário de admissão até a data da rescisão).

```
1. Encontrar a data do último aniversário de admissão antes da rescisão
2. Contar meses desde o aniversário até a rescisão (≥15 dias restantes = +1 mês)
3. Somar meses projetados pelo aviso prévio indenizado (se houver — ver §3.3)
4. Máximo: 12 avos

Férias Proporcionais = (Remuneração / 12) × Meses × (4/3)
```

**Não devidas na justa causa.**

### 3.6. 13º Salário Proporcional

Calculado com base nos meses trabalhados no ano da rescisão (ou desde a admissão, se no mesmo ano).

```
1. Início da contagem = max(1º de janeiro, data de admissão)
2. Contar meses até a rescisão (≥15 dias restantes = +1 mês)
3. Somar meses projetados pelo aviso prévio indenizado (se houver — ver §3.3)
4. Máximo: 12 avos

13º Proporcional = (Remuneração / 12) × Meses
```

**Não devido na justa causa.**

### 3.7. FGTS

#### FGTS Acumulado (estimativa)

Estimativa do saldo na conta vinculada, baseada na remuneração atual:

```
FGTS Acumulado = Remuneração × 8% × Meses Trabalhados (total)
```

> Este valor é apenas informativo. O saldo real depende dos depósitos efetivamente realizados ao longo do contrato. Ele **não entra no total de verbas rescisórias** — é sacado à parte pelo trabalhador via chave FGTS Digital.
>
> **O saque do FGTS acumulado só é possível em determinados tipos de rescisão** (ver tabela na §2). No pedido de demissão e na justa causa, o trabalhador **não** pode sacar o FGTS. No acordo mútuo (art. 484-A), o saque é limitado a 80% do saldo.

#### FGTS Rescisório

O FGTS incide sobre as verbas rescisórias pagas na rescisão:

```
FGTS Rescisório = (Saldo de Salário + Aviso Prévio + 13º Proporcional) × 8%
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

## 4. Total Estimado

O total representa as **verbas rescisórias brutas** pagas diretamente ao trabalhador, sem incluir o FGTS acumulado (que é sacado separadamente):

```
Total = Saldo de Salário
      + Aviso Prévio
      + Férias Vencidas + 1/3
      + Férias Proporcionais + 1/3
      + 13º Proporcional
      + FGTS Rescisório
      + Multa FGTS
```

---

## 5. Limitações e Observações

1. **FGTS acumulado é estimativa**: usa a remuneração atual multiplicada pelo período todo. O valor real depende dos depósitos efetuados mensalmente.
2. **Sem descontos**: INSS e IRRF não são descontados. O resultado é bruto.
3. **Hora noturna reduzida**: assume que o valor de "média de horas noturnas" já considera a hora reduzida (52min30s = 1h noturna) ou é hora relógio.
4. **Férias vencidas**: o usuário informa manualmente o número de dias de férias vencidas.
5. **Término de contrato**: trata como encerramento **normal** de contrato por prazo determinado — sem aviso prévio e sem multa de FGTS. Se a rescisão for antecipada pelo empregador, usar "Sem Justa Causa".
6. **Pedido de demissão**: o aviso prévio não é contabilizado como verba a receber. O desconto do aviso não cumprido (caso o empregador exija) não é aplicado automaticamente — o resultado é o mínimo que o empregado recebe.
7. **Saque FGTS no acordo mútuo**: a legislação limita o saque a 80% do saldo acumulado. A calculadora exibe o valor total estimado — o trabalhador deve aplicar o limite de 80% sobre o saldo real.

---

## 6. Referências Legais

- **CLT** (Decreto-Lei 5.452/1943) — arts. 73, 192, 193, 457, 477, 478, 487
- **Lei 12.506/2011** — Aviso prévio proporcional ao tempo de serviço
- **Lei 13.467/2017** (Reforma Trabalhista) — art. 484-A (rescisão por acordo mútuo)
- **Lei 8.036/1990** — FGTS (art. 18: multa de 40%; art. 20: hipóteses de saque)
- **Constituição Federal** — art. 7º, XVII (terço de férias), XXI (aviso prévio proporcional)
- **Salário Mínimo 2025**: R$ 1.621,00 (Decreto 12.797/2025)
