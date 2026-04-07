# Calculadora de Fator Previdenciário — Método de Cálculo

## Visão Geral

A calculadora de fator previdenciário aplica a fórmula atuarial definida pela Lei 9.876/1999 (Art. 29, §7°). O fator é um multiplicador que pondera o benefício com base no tempo de contribuição, idade e expectativa de sobrevida do segurado.

**Importante**: O fator previdenciário é **obrigatório** apenas na aposentadoria por tempo de contribuição pré-reforma e no Pedágio 50%. Nas demais regras pós-EC 103/2019, é substituído pelo coeficiente de 60% + 2% por ano excedente.

**Base legal**: Lei 9.876/1999 (Art. 29, §7° e §8°) e EC 103/2019 (Art. 17).

---

## 1. Dados de Entrada

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `tempo_contribuicao_anos` | float | Sim | Tempo de contribuição em anos decimais |
| `idade` | float | Sim | Idade do segurado em anos decimais |
| `sexo` | "M" ou "F" | Sim | Sexo do segurado |
| `expectativa_sobrevida` | float | Sim | Expectativa de sobrevida (Es) pela tábua IBGE |

---

## 2. Fórmula

```
f = (Tc × a / Es) × [1 + (Id + Tc × a) / 100]
```

Onde:

| Variável | Descrição |
|---|---|
| **Tc** | Tempo de contribuição em anos (com bônus, ver §3) |
| **a** | Alíquota fixa = **0,31** |
| **Es** | Expectativa de sobrevida na data da aposentadoria (tábua IBGE) |
| **Id** | Idade do segurado em anos decimais |

### Caso especial

Se `Es <= 0` (expectativa de sobrevida inválida), o fator retorna **1,0** como fallback.

---

## 3. Bônus por Sexo

A lei concede um acréscimo de **5 anos** ao tempo de contribuição para mulheres no cálculo do fator:

```
Se sexo == "F":
  Tc (para fórmula) = tempo_contribuicao_anos + 5
Senão:
  Tc (para fórmula) = tempo_contribuicao_anos
```

> **Nota sobre professores**: A Lei 9.876/1999 prevê bônus adicional de 5 anos para professor e 10 anos para professora. Na implementação atual, o bônus de professor é tratado indiretamente — o tempo de contribuição mínimo reduzido do professor já incorpora esse diferencial.

---

## 4. Expectativa de Sobrevida (Es)

A expectativa de sobrevida é obtida da **tábua de mortalidade do IBGE** mais recente, que mapeia a idade do segurado à expectativa de vida remanescente em anos.

### Interpolação

Quando a idade exata não consta na tábua, é feita **interpolação linear** entre as duas idades mais próximas:

```
Se idade está entre idade_i e idade_(i+1):
  fração = (idade - idade_i) / (idade_(i+1) - idade_i)
  Es = Es_i + fração × (Es_(i+1) - Es_i)
```

Para idades abaixo do mínimo ou acima do máximo da tábua, utiliza-se o valor do extremo correspondente. Se a tábua não estiver disponível, o fallback é `Es = 20.0`.

---

## 5. Exemplo de Cálculo

**Dados**: Homem, 60 anos, 35 anos de contribuição, Es = 22,5

```
Tc = 35 (sem bônus — sexo masculino)
a  = 0,31

f = (35 × 0,31 / 22,5) × [1 + (60 + 35 × 0,31) / 100]
f = (10,85 / 22,5) × [1 + (60 + 10,85) / 100]
f = 0,4822 × [1 + 0,7085]
f = 0,4822 × 1,7085
f = 0,8237
```

O benefício seria 82,37% da média salarial.

**Dados**: Mulher, 58 anos, 30 anos de contribuição, Es = 25,0

```
Tc = 30 + 5 = 35 (bônus mulher)
a  = 0,31

f = (35 × 0,31 / 25,0) × [1 + (58 + 35 × 0,31) / 100]
f = (10,85 / 25,0) × [1 + (58 + 10,85) / 100]
f = 0,4340 × [1 + 0,6885]
f = 0,4340 × 1,6885
f = 0,7328
```

---

## 6. Resultado

| Campo | Tipo | Descrição |
|---|---|---|
| `valor` | float | Fator previdenciário (arredondado para 4 casas decimais) |
| `formula_detalhada` | string | Fórmula com os valores substituídos (ex: `(35.0 × 0.31 / 22.5) × [1 + (60.0 + 35.0 × 0.31) / 100] = 0.8237`) |
| `tc_usado` | float | Tempo de contribuição utilizado (com bônus, se aplicável) |
| `es_usado` | float | Expectativa de sobrevida utilizada |
| `id_usado` | float | Idade utilizada |

---

## 7. Uso na Simulação de Aposentadoria

O fator previdenciário é utilizado em dois cenários da simulação:

| Cenário | Aplicação |
|---|---|
| **Pedágio 50%** (Art. 17, EC 103/2019) | Obrigatório — benefício = média × fator |
| **Direito Adquirido** (tempo de contribuição pré-reforma) | Obrigatório quando não atinge a regra 85/95 pontos |

Nos cenários pós-reforma (Permanente, Pontos, Idade Progressiva, Pedágio 100%), o fator é substituído pelo **coeficiente de benefício**: `60% + 2% por ano excedente`.

Ver [Simulação de Aposentadoria](simulacao-aposentadoria.md) para detalhes de como o fator é aplicado em cada cenário.

---

## 8. Observações

1. **Fator < 1,0**: Na maioria dos casos, o fator é menor que 1,0, reduzindo o benefício. Isso ocorre quando o segurado se aposenta jovem ou com pouco tempo de contribuição.
2. **Fator > 1,0**: É possível (mas raro) obter fator superior a 1,0 com combinação de idade avançada e longo tempo de contribuição.
3. **Gratuidade**: Esta calculadora não consome créditos na plataforma, pois é um cálculo simples e instantâneo (sem processamento assíncrono via worker).

---

## 9. Referências Legais

- **Lei 9.876/1999** — Introduz o fator previdenciário (Art. 29, §7° e §8°)
- **Lei 8.213/1991** — Plano de Benefícios da Previdência Social
- **EC 103/2019** — Reforma da Previdência (Art. 17: Pedágio 50% com fator obrigatório)
- **IBGE** — Tábua Completa de Mortalidade (publicação anual)
