# Transcrições para a demo

Para colar em **Iniciar consulta → "ou cole o texto da consulta"**, na Demo simples.
Cada texto combina com o paciente e com o histórico que a demo já carrega, então o
revisor (passo 5) e a guia mostram o que se espera.

| Horário | Paciente | Convênio | O que mostra |
|---|---|---|---|
| 09:00 | Maria Fernanda Costa | Unimed | **Alerta de alergia vindo do histórico** (dentista prescreve dipirona; ela é alérgica) |
| 10:30 | João Pedro Almeida | Amil | Retorno simples; o revisor lembra da **alergia a penicilina** do histórico |
| 14:00 | Ana Beatriz Souza | Bradesco Saúde | **Canal: 7 etapas viram 1 código TUSS** na guia, com raio-x inicial e final |
| 16:00 | Carlos Eduardo Lima | Particular | Check-up + odontograma com vários dentes |

Copie só o texto dentro de cada bloco.

> ⚠️ **Espere ~1 minuto entre uma geração e outra.** O Groq gratuito libera 8.000 tokens por
> minuto e um prontuário usa quase tudo isso. Duas seguidas fazem a segunda sair incompleta
> (sem CID, sem odontograma). Gerar a guia e usar o chat também consomem desse limite.

---

## 1. Maria Fernanda Costa — 09:00 (Consulta)

> Histórico na demo: restauração no 46 há 2 dias, **alergia a dipirona** registrada.
> Hoje a dentista não pergunta sobre alergias e prescreve dipirona: o revisor cruza com o histórico e acusa.

```
Dentista: Bom dia, Maria! Tudo bem? Como ficou aquela restauração do dente de baixo?
Paciente: Bom dia, doutora. A de baixo ficou ótima, não doeu mais. Mas agora está doendo um dente aqui em cima, do lado esquerdo, quando eu como doce.
Dentista: Doce e gelado? Dói muito tempo depois?
Paciente: Mais com doce. Dói um pouquinho e passa.
Dentista: Deixa eu ver. Abre bem... Aqui no segundo pré-molar superior esquerdo, o dente 25, tem uma cárie na face distal, entre os dentes. Já passou do esmalte e atingiu a dentina, mas não chegou perto do nervo. O 24 do lado está bom. A gengiva está bem melhor do que na última vez.
Paciente: Que bom. Dá pra arrumar hoje?
Dentista: Dá sim. Vou aplicar anestesia local, um tubete de lidocaína a 2% com epinefrina, remover a cárie e fazer uma restauração de resina composta no 25, face distal.
Paciente: Tá bom.
Dentista: Pronto, terminei. Ficou bem vedado. Se sentir dor depois que passar a anestesia, pode tomar dipirona 500 miligramas de seis em seis horas.
Paciente: Combinado, doutora.
Dentista: Evite comer nas próximas duas horas, até passar a anestesia. E mantém o fio dental todo dia. A gente já tinha combinado a limpeza, então vamos manter a profilaxia para daqui a duas semanas.
Paciente: Perfeito, obrigada!
```

---

## 2. João Pedro Almeida — 10:30 (Retorno)

> Histórico na demo: extração da raiz residual do 48 com 2 pontos, retorno em 7 dias.
> Consulta simples. O revisor puxa do histórico a alergia a penicilina (risco se prescrever amoxicilina).

```
Dentista: Oi, João Pedro! Veio tirar os pontos, né? Como foi a semana?
Paciente: Oi, doutora. Foi tranquila. Doeu só nos dois primeiros dias, depois parou. Não precisei mais de remédio.
Dentista: Ótimo. Teve inchaço ou sangramento?
Paciente: Inchou um pouquinho no começo, mas já sumiu.
Dentista: Deixa eu ver a região do 48. Abre a boca... A cicatrização está muito boa, a gengiva está fechando bem, sem sinal de infecção, sem pus, sem inchaço. Os dois pontos estão no lugar. Só notei uma gengivite leve nos dentes da frente de baixo, por acúmulo de placa, nada sério.
Paciente: Vai doer pra tirar?
Dentista: Não, é rapidinho, nem precisa de anestesia. Vou remover os dois pontos agora... Pronto, já foi.
Paciente: Nem senti.
Dentista: Essa região ainda está cicatrizando por dentro. Capriche no fio dental nos dentes da frente pra gengivite regredir. Continue escovando com cuidado ali atrás e faça bochecho com água morna e sal depois das refeições por mais três dias. Pode voltar a mastigar normalmente.
Paciente: Beleza.
Dentista: Está tudo certo. Vamos marcar um check-up de rotina daqui a seis meses.
Paciente: Combinado, obrigado, doutora!
```

---

## 3. Ana Beatriz Souza — 14:00 (Consulta)

> Histórico na demo: urgência no 26 (pulpectomia parcial + curativo), retorno para iniciar o canal.
> Na guia (aba Cobranças → Gerar guia): as etapas técnicas do canal são **consolidadas em um único
> código de endodontia multirradicular**, mais as radiografias. Bom momento para mostrar o raciocínio ao vivo.

```
Dentista: Boa tarde, Ana! Como está o dente depois daquele atendimento de urgência?
Paciente: Boa tarde, doutora. Melhorou muito. Aquela dor horrível passou, só sinto um incômodo leve quando mastigo daquele lado.
Dentista: Normal, o curativo está segurando. Hoje vamos fazer o tratamento de canal completo do 26, o primeiro molar superior esquerdo. Primeiro vou fazer uma radiografia periapical inicial pra ver os canais.
Paciente: Tudo bem.
Dentista: Na radiografia dá pra ver três raízes e uma pequena lesão no ápice da raiz mesial. É uma periodontite apical crônica no 26, a polpa já estava comprometida. Vou aplicar anestesia local, dois tubetes de articaína 4% com epinefrina, e colocar o isolamento absoluto com dique de borracha.
Paciente: Pode ir.
Dentista: Estou removendo o curativo e o selamento provisório. Localizei quatro canais: mesiovestibular, um segundo mesiovestibular, distovestibular e palatino. Vou fazer o preparo químico-mecânico com limas rotatórias e irrigação com hipoclorito de sódio a 2,5%.
Paciente: Hum-hum.
Dentista: Agora a obturação dos canais com guta-percha e cimento endodôntico. Vou fazer a radiografia periapical final pra conferir... A obturação ficou bem adaptada até o ápice nos quatro canais. Vou fechar com restauração provisória de ionômero de vidro.
Paciente: Acabou?
Dentista: Acabou o canal. Pode ficar dolorido por dois ou três dias. Se doer, pode tomar ibuprofeno 400 miligramas de oito em oito horas. Evite mastigar coisas duras desse lado até colocarmos a coroa.
Paciente: E quando faz a coroa?
Dentista: Volte em uma semana para a gente avaliar e planejar a coroa definitiva do 26.
Paciente: Combinado. Obrigada, doutora!
```

---

## 4. Carlos Eduardo Lima — 16:00 (Check-up)

> Particular (sem convênio): não gera guia. Serve para mostrar o **odontograma** preenchido com vários dentes.

```
Dentista: Boa tarde, seu Carlos! Check-up de rotina hoje. Está sentindo alguma coisa?
Paciente: Boa tarde. Nada de dor, doutora. Só acho que meus dentes estão mais amarelados.
Dentista: Ainda toma muito café?
Paciente: Uns quatro por dia. E continuo tomando o remédio da pressão, a losartana, e agora também o metformina pra diabetes, que o médico passou mês passado.
Dentista: Importante saber, vou anotar. Vamos ver... Mucosa, língua e bochechas normais, sem lesões. ATM sem estalos. Tem acúmulo de tártaro nos incisivos inferiores e um pouco de sangramento na gengiva quando eu sondo, principalmente na região dos molares inferiores.
Paciente: É por causa da diabetes?
Dentista: A diabetes aumenta o risco de problema na gengiva, por isso vamos acompanhar de perto. Agora os dentes: a restauração de amálgama do 16 está boa. Aquela mancha branca no 17, que a gente estava monitorando, continua igual, não progrediu. O 36 já foi extraído há anos, está ausente. E no 15 tem uma cárie pequena na face oclusal, bem no início, só no esmalte.
Paciente: Precisa tratar já?
Dentista: Hoje eu vou fazer a raspagem do tártaro, o polimento e a aplicação de flúor. A cárie do 15 a gente restaura na próxima consulta.
Paciente: Tudo bem.
Dentista: Pronto. As manchas de café saíram bastante com o polimento. Use fio dental todo dia, principalmente nos molares de baixo, e diminua o café se puder. Volte em quinze dias para restaurar o 15, e depois a gente faz o controle da gengiva a cada três meses por causa da diabetes.
Paciente: Combinado, doutora. Obrigado.
```
