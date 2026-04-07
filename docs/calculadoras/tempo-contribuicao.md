# Calculadora de Tempo de Contribuição — Método de Cálculo

## Visão Geral

A calculadora de tempo de contribuição totaliza o período de contribuição previdenciária do segurado a partir dos seus vínculos empregatícios. O resultado é utilizado como insumo para a simulação de aposentadoria e para consultas avulsas.

**Base legal**: CLT, Lei 8.213/1991, Decreto 3.048/1999 e EC 103/2019.

---

## 1. Dados de Entrada

A calculadora aceita dois modos de entrada:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `data_inicio` | date | Sim | Data de início do vínculo |
| `data_fim` | date | Não | Data de fim (null = vínculo ativo) |
| `empresa` | string | Não | Nome do empregador |
| `cnpj` | string | Não | CNPJ do empregador |
| `tipo_vinculo` | enum | Não | Empregado, Contribuinte Individual, Facultativo, Avulso, Doméstico, Segurado Especial, Servidor Público, Benefício |
| `atividade_especial` | bool | Não | Se o período é de atividade especial |
| `categoria_especial` | enum | Não | 15, 20 ou 25 anos (grau de exposição) |

**Importação automática**: Os vínculos podem ser importados de um PDF do CNIS (Cadastro Nacional de Informações Sociais) via extração determinística (pymupdf, sem IA).

---

## 2. Tratamento de Vínculos Abertos

Vínculos sem `data_fim` são considerados **ativos até a data de referência**:

```
data_fim efetiva = data_referência (padrão: hoje)
```

Um alerta é emitido para cada vínculo aberto identificado.

---

## 3. Tratamento de Sobreposições

Quando dois ou mais vínculos possuem períodos sobrepostos (trabalho concomitante), o tempo sobreposto é **contado apenas uma vez**.

### Algoritmo de merge

1. Ordenar todos os intervalos `(data_inicio, data_fim)` por `data_inicio`
2. Percorrer sequencialmente:
   - Se o início do próximo intervalo é anterior ou igual ao fim do intervalo atual + 1 dia (adjacência), unir os dois: `(min(inicio), max(fim))`
   - Caso contrário, iniciar um novo intervalo
3. Resultado: lista de intervalos sem sobreposição

```
Exemplo:
  Vínculo A: 01/01/2010 — 31/12/2015
  Vínculo B: 01/06/2013 — 31/12/2018
  
  Merge:     01/01/2010 — 31/12/2018 (único intervalo)
```

Um alerta é emitido para cada par de vínculos sobrepostos.

---

## 4. Detecção de Lacunas

Após o merge, lacunas maiores que **365 dias** entre intervalos consecutivos são sinalizadas com alerta informativo:

```
Se (inicio_proximo - fim_atual - 1) >= 365 dias:
  → Alerta: "Lacuna de Xa Ym entre DD/MM/YYYY e DD/MM/YYYY"
```

---

## 5. Conversão de Tempo Especial

Atividades exercidas em condições especiais (exposição a agentes nocivos) podem ser convertidas em tempo comum com um multiplicador, conforme o Decreto 3.048/1999, Art. 66.

**Restrição**: A conversão é permitida **apenas para períodos anteriores à EC 103/2019** (13/11/2019), conforme Art. 25, §2°.

### Multiplicadores de conversão

| Categoria (anos de exposição) | Homem (M) | Mulher (F) |
|:---:|:---:|:---:|
| 15 anos | 2,33 | 2,00 |
| 20 anos | 1,75 | 1,50 |
| 25 anos | 1,40 | 1,20 |

### Fórmula

```
Para cada vínculo com atividade especial:
  fim_especial = min(data_fim, 13/11/2019)
  
  Se data_inicio < fim_especial:
    dias_periodo = (fim_especial - data_inicio) + 1
    bonus = dias_periodo × (multiplicador - 1)
    
    Total de dias += bonus
```

O multiplicador converte o tempo especial em tempo comum equivalente. Exemplo: 25 anos de atividade especial (categoria 25) equivalem a 35 anos de tempo comum para homens (25 × 1,40 = 35).

---

## 6. Contagem de Dias

A contagem segue a convenção do INSS:

```
Dias entre duas datas = (data_fim - data_inicio) + 1  (inclusive em ambas as pontas)
```

O total de dias é a soma dos dias de todos os intervalos após o merge, mais os dias bônus de conversão especial.

---

## 7. Conversão para Anos/Meses/Dias

A calculadora utiliza a **convenção INSS** (ano comercial):

```
1 ano  = 360 dias
1 mês  = 30 dias

Anos   = total_dias ÷ 360 (parte inteira)
Restante = total_dias mod 360
Meses  = restante ÷ 30 (parte inteira)
Dias   = restante mod 30
```

A propriedade `total_anos_decimal` também é disponibilizada para uso em fórmulas:

```
total_anos_decimal = total_dias / 360
```

---

## 8. Resultado

| Campo | Tipo | Descrição |
|---|---|---|
| `anos` | int | Anos completos de contribuição |
| `meses` | int | Meses restantes (0–11) |
| `dias` | int | Dias restantes (0–29) |
| `total_dias` | int | Total absoluto em dias |
| `vinculos_processados` | int | Quantidade de vínculos analisados |
| `alertas` | list | Vínculos abertos, sobreposições, lacunas, conversões |

---

## 9. Projeção Futura

A calculadora também oferece a função `calcular_tempo_na_data(vinculos, data_alvo)`, que projeta o tempo de contribuição em uma data futura. Vínculos abertos são automaticamente considerados ativos até a data alvo.

Esta função é utilizada internamente pela simulação de aposentadoria para:
- Avaliar elegibilidade em cada cenário
- Projetar mês a mês até encontrar a data de elegibilidade
- Calcular o tempo de contribuição projetado para a seção de projeção futura

---

## 10. Limitações e Observações

1. **Sexo para multiplicador especial**: Na calculadora avulsa, o sexo não é informado — o multiplicador assume sexo masculino por padrão. Na simulação completa, o sexo do segurado é utilizado.
2. **Vínculos inválidos**: Vínculos com `data_fim` anterior a `data_inicio` são ignorados com alerta.
3. **Adjacência**: Dois vínculos cuja diferença entre o fim de um e o início do outro é de apenas 1 dia são tratados como contínuos (merge).
4. **Conversão pós-reforma**: Períodos especiais após 13/11/2019 **não** recebem conversão — a EC 103/2019 extinguiu essa possibilidade.

---

## 11. Referências Legais

- **Lei 8.213/1991** — Plano de Benefícios da Previdência Social
- **Decreto 3.048/1999** — Regulamento da Previdência Social (Art. 66: conversão de tempo especial)
- **EC 103/2019** — Reforma da Previdência (Art. 25, §2°: fim da conversão de tempo especial)
- **IN INSS/PRES 128/2022** — Instruções normativas do INSS (contagem de tempo)
