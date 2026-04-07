# Calculadora de Média Salarial — Método de Cálculo

## Visão Geral

A calculadora de média salarial (salário de benefício) calcula a média das contribuições previdenciárias do segurado, com correção monetária pelo INPC, produzindo dois valores:

- **Média 100%** (pós-reforma, EC 103/2019): média aritmética de **todas** as contribuições desde julho/1994
- **Média 80%** (pré-reforma / direito adquirido): média aritmética das **80% maiores** contribuições desde julho/1994

**Base legal**: Lei 9.876/1999, Lei 8.213/1991 (Art. 29) e EC 103/2019 (Art. 26).

---

## 1. Dados de Entrada

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `competencia` | date (YYYY-MM-01) | Sim | Mês/ano da contribuição |
| `valor` | Decimal | Sim | Valor nominal da remuneração |
| `indicadores` | list[string] | Não | Indicadores do CNIS (ex: PREC-RECOLH) |

**Importação automática**: As remunerações podem ser importadas de um PDF do CNIS via extração determinística.

### Parâmetros adicionais

| Parâmetro | Padrão | Descrição |
|---|---|---|
| `indices_inpc` | null | Mapa competência → fator de correção acumulado INPC |
| `teto_atual` | R$ 8.475,55 | Teto do INSS vigente |
| `piso_atual` | R$ 1.621,00 | Piso (salário mínimo) vigente |

---

## 2. Filtro: Plano Real

Somente contribuições a partir de **julho de 1994** são consideradas no cálculo, conforme a Lei 9.876/1999:

```
Contribuição válida: competência >= 01/07/1994
```

Contribuições anteriores a essa data são descartadas.

---

## 3. Agrupamento de Concomitantes

Quando o segurado possui **vínculos simultâneos** (trabalho concomitante), as remunerações do mesmo mês são **somadas** e limitadas ao teto do INSS:

```
Para cada competência:
  valor_agrupado = min(soma de todas as remunerações do mês, teto_atual)
```

Isso garante que a base de cálculo respeite o teto previdenciário, mesmo com múltiplos vínculos.

---

## 4. Correção Monetária (INPC)

Cada contribuição é corrigida monetariamente pelo **INPC** (Índice Nacional de Preços ao Consumidor) acumulado até o mês de referência:

```
valor_corrigido = valor_nominal × fator_INPC(competência)
```

Após a correção, o valor é novamente **limitado ao teto**:

```
valor_final = min(valor_corrigido, teto_atual)
```

Se os índices INPC não forem fornecidos, os valores nominais são utilizados sem correção.

> **Nota**: Os fatores de correção INPC são mantidos no banco de dados e atualizados periodicamente. Cada fator representa o acumulado desde a competência até o mês de referência atual.

---

## 5. Cálculo da Média 100% (Pós-Reforma)

Introduzida pela EC 103/2019 (Art. 26), utiliza **todas** as contribuições desde julho/1994:

```
Média 100% = Soma de todos os valores corrigidos / Quantidade de contribuições
```

### Aplicação de piso e teto

```
Média 100% final = max(piso, min(Média 100%, teto))
```

A média é garantida entre o salário mínimo e o teto do INSS.

---

## 6. Cálculo da Média 80% (Pré-Reforma)

Utilizada para **direito adquirido** e regras anteriores à EC 103/2019. Descarta as 20% menores contribuições:

```
1. Ordenar valores corrigidos em ordem decrescente
2. qtd_80 = max(1, int(total_contribuições × 0.80))
3. Selecionar os qtd_80 maiores valores
4. Média 80% = Soma dos selecionados / qtd_80
```

### Aplicação de piso e teto

```
Média 80% final = max(piso, min(Média 80%, teto))
```

---

## 7. Resultado

| Campo | Tipo | Descrição |
|---|---|---|
| `media_100` | Decimal | Média de 100% das contribuições (regra pós-reforma) |
| `media_80` | Decimal | Média das 80% maiores contribuições (regra pré-reforma) |
| `qtd_contribuicoes` | int | Quantidade de contribuições processadas (após filtro jul/1994 e agrupamento) |
| `maior_contribuicao` | Decimal | Maior valor corrigido individual |
| `menor_contribuicao` | Decimal | Menor valor corrigido individual |

---

## 8. Uso na Simulação de Aposentadoria

A média salarial é utilizada pela simulação de aposentadoria de duas formas:

- **Média 100%**: Base de cálculo para as regras pós-reforma (Permanente, Pontos, Idade Progressiva, Pedágio 50%, Pedágio 100%)
- **Média 80%**: Base de cálculo para o cenário de Direito Adquirido (regras pré-reforma)

Ver [Simulação de Aposentadoria](simulacao-aposentadoria.md) para detalhes de como as médias são aplicadas em cada cenário.

---

## 9. Limitações e Observações

1. **Precisão decimal**: Todos os cálculos utilizam `Decimal` com arredondamento `ROUND_HALF_UP` (2 casas decimais) para evitar erros de ponto flutuante.
2. **Índices INPC**: Se não fornecidos, os valores nominais são usados. Isso reduz a precisão do cálculo, especialmente para contribuições antigas.
3. **Teto duplo**: O teto é aplicado duas vezes — primeiro no agrupamento de concomitantes, depois após a correção monetária. Isso é intencional: o valor nominal não pode ultrapassar o teto da época, e o valor corrigido não pode ultrapassar o teto atual.
4. **Contribuições zeradas**: Remunerações com valor zero ou negativo não são excluídas automaticamente — devem ser removidas pelo usuário antes do cálculo.

---

## 10. Referências Legais

- **Lei 8.213/1991** — Plano de Benefícios da Previdência Social (Art. 29: salário de benefício)
- **Lei 9.876/1999** — Altera o cálculo do salário de benefício (média desde jul/1994)
- **EC 103/2019** — Reforma da Previdência (Art. 26: média de 100% das contribuições)
- **Decreto 3.048/1999** — Regulamento da Previdência Social
