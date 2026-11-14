---
title: "I-02 — Métodos de similitud análoga multivariable"
type: investigacion
status: borrador
date: 2026-11-03
updated: 2026-11-05
summary: "Qué métodos publicados existen para medir la similitud entre sitios planetarios y terrestres con distancia ponderada: normalización, métrica de distancia, ponderación y agregación espacial."
autor: fernando
tipo_investigacion: B
riesgo: critico
---

# I-02 — Métodos de similitud análoga multivariable

Consulta sobre métodos publicados de normalización, métricas de similitud con distancia ponderada y agregación multiescala.

## Prompt

```
I-02 — Índice de similitud análoga

Actúa como un investigador en geomorfología computacional y ciencia de datos planetarios. ¿Qué métodos publicados de similitud con distancia ponderada se usan para comparar sitios planetarios (Luna, Marte) con análogos geológicos terrestres a partir de varias variables de terreno y clima?

1. Describe métodos de normalización resistentes a valores extremos y que hagan comparables variables de cuerpos distintos (Marte, Luna, Tierra).
2. Compara métricas de distancia multidimensional: Mahalanobis frente a coseno y euclidiana ponderadas, y su tratamiento de variables correlacionadas.
3. Revisa métodos en la literatura para ponderar variables según el uso del análogo y reportar el aporte de cada variable.
4. Describe métodos publicados de agregación espacial por percentiles y de tratamiento de máscaras de agua.
5. Explica cómo se tratan las diferencias que ninguna variable mide (gravedad, atmósfera, radiación).
6. Resume las ecuaciones publicadas relevantes y la bibliografía que respalda cada método.

ENTREGA
- Ecuaciones con su justificación breve.
- Bibliografía con URL de papers o documentación que respalde cada elección.
```

## Resultado

Revisión de métodos publicados de similitud con distancia ponderada:

### Técnicas identificadas en la literatura

Las técnicas siguientes son alternativas publicadas en la literatura; las citas no se verificaron en la fuente.

1. **Normalización resistente a extremos:** transformación de asimetría (Yeo y Johnson 2000), centrado en la mediana y escalado mediante el estimador $Q_n$ de Rousseeuw y Croux (1993) —82 % de eficiencia gaussiana frente a 37 % de MAD—, con acotamiento suave mediante tangente hiperbólica (alternativa publicada).
2. **Variables dependientes del ambiente** (inercia térmica, temperatura, viento): en la comparación entre cuerpos planetarios se normalizan dentro de la distribución de cada cuerpo o se convierten a magnitudes físicas equivalentes (tamaño de grano efectivo vía conductividad en atmósfera marciana según Presley y Christensen 1997; parámetro de Shields para transporte eólico). Las variables intrínsecas de terreno se comparan con escala común.
3. **Métrica:** distancia de Mahalanobis ponderada con matriz de correlación regularizada mediante contracción hacia la identidad (Ledoit y Wolf 2004), para mitigar la colinealidad entre pendiente y rugosidad. La similitud coseno no captura diferencias de magnitud.
4. **Métodos de similitud con distancia ponderada y descomposición por variable:** transformación exponencial de la distancia como alternativa publicada, con blanqueo ZCA-cor (Kessy et al. 2018) para descomponer el aporte de cada variable sin signos negativos. Foucher et al. (2021) presentan ejemplos de evaluación multi-variable de análogos sin fijar pesos universales en la literatura; las variables categóricas (como mineralogía) requieren métricas mixtas como Gower o divergencia de Jensen-Shannon ([[I-09-metodos-de-busqueda-de-analogos]]).
5. **Factores no comparables directamente** (gravedad, atmósfera, radiación; Hassler et al. 2014 reporta 76 mGy/año en superficie marciana): quedan fuera del vector geomorfológico-climático y se documentan por separado.
6. **Máscaras de tierra:** algunos análogos documentados están bajo el nivel del mar (Danakil, mar Muerto, valle de la Muerte); un criterio de máscara basado en elevación positiva los excluiría, mientras que las máscaras basadas en agua superficial no ([[I-10-mascaras-de-agua]]).

### Ecuaciones de los métodos revisados

| # | Método / concepto | Ecuación | Referencia |
| :-- | :-- | :-- | :-- |
| 1 | Transformación Yeo-Johnson | $y_i=\frac{(x_i+1)^{\lambda_i}-1}{\lambda_i}$ si $x_i\ge0$; $-\frac{(-x_i+1)^{2-\lambda_i}-1}{2-\lambda_i}$ si $x_i<0$ | Yeo y Johnson (2000) |
| 2 | Estimador de escala $Q_n$ | $Q_n=d_n\cdot2.21914\cdot\{\lvert y^{(j)}-y^{(k)}\rvert;\,j<k\}_{(m)}$, $m=\binom{\lfloor N/2\rfloor+1}{2}$ | Rousseeuw y Croux (1993) |
| 3 | Estandarización resistente | $z^{raw}_i=\frac{y_i-\mathrm{med}_B(y_i)}{Q_{n,B}(y_i)+\epsilon_0}$, acotamiento suave con tangente hiperbólica | Rousseeuw y Croux (1993) |
| 4 | Contracción de matriz de correlación | $\hat R_{LW}=(1-\delta)R+\delta I$ | Ledoit y Wolf (2004) |
| 5 | Distancia de Mahalanobis ponderada | $M_w=W^{1/2}\hat R_{LW}^{-1}W^{1/2}$, $D^2=\sum_i\sum_j\sqrt{w_iw_j}\,(\hat R^{-1}_{LW})_{ij}\,\Delta z_i\Delta z_j$ | Mahalanobis (1936) |
| 6 | Desglose por variable (ZCA-cor) | $\delta=M_w^{1/2}\Delta z$, $\lVert\delta\rVert^2=D^2=\sum\delta_i^2$, $\eta_i=\delta_i^2/D^2$ | Kessy et al. (2018) |
| 7 | Parámetro de Shields (umbral eólico) | $\Theta=\frac{\rho_f u_*^2}{(\rho_p-\rho_f)gd}$ | Shields (1936) |

### Literatura citada

- Mahalanobis, P. C. (1936). *On the generalized distance in statistics*. Proceedings of the National Institute of Sciences of India.
- Yeo, I.-K. y Johnson, R. A. (2000). *A new family of power transformations to improve normality or symmetry*. Biometrika.
- Rousseeuw, P. J. y Croux, C. (1993). *Alternatives to the Median Absolute Deviation*. JASA.
- Ledoit, O. y Wolf, M. (2004). *A well-conditioned estimator for large-dimensional covariance matrices*. Journal of Multivariate Analysis.
- Kessy, A., Lewin, A. y Strimmer, K. (2018). *Optimal Whitening and Decorrelation*. The American Statistician.
- Presley, M. A. y Christensen, P. R. (1997). *Thermal conductivity measurements of particulate materials*. JGR.
- Farber, O. y Kadmon, R. (2003). *Assessment of alternative approaches for bioclimatic modeling with special emphasis on the Mahalanobis distance*. Ecological Modelling.
- Foucher, F. et al. (2021). *Definition and use of functional analogues in planetary exploration*. Planetary and Space Science.
- Hassler, D. M. et al. (2014). *Mars' Surface Radiation Environment Measured with the Mars Science Laboratory's Curiosity Rover*. Science.

## Relaciones

- [[I-08-cuadriculas-de-area-igual]] — cuadrículas de área igual
- [[I-09-metodos-de-busqueda-de-analogos]] — métricas y búsqueda de análogos
- [[I-10-mascaras-de-agua]] — máscaras de agua
- [[I-11-sesgo-por-escala-de-cada-variable]] — sesgo por escala de las variables
- [[I-16-normalizacion-y-puntaje-con-unidades-distintas]] — normalización con unidades distintas y datos faltantes
