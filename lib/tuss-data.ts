// GERADO por scripts/gen_tuss_context.py — NÃO editar à mão.
// Fonte: knowledge_base/TUSS_Odontologica_Jasmin.xlsx (370 procedimentos odontológicos vigentes).
// Regere com: npm run gen:tuss

/** Uma entrada oficial da tabela TUSS odontológica. */
export interface TussDataEntry {
  descricao: string;
  categoria: string;
}

/** Bloco formatado para o system prompt do Passo 4 (uma linha por procedimento). */
export const TUSS_CONTEXT_STRING: string = "82000026 | Acompanhamento de tratamento/procedimento cirúrgico em odontologia | inclui:\n82000034 | Alveoloplastia | inclui:\n82000050 | Amputação radicular com obturação retrógrada | inclui:\n82000069 | Amputação radicular sem obturação retrógrada | inclui:\n82000077 | Apicetomia birradiculares com obturação retrógrada | inclui:\n82000085 | Apicetomia birradiculares sem obturação retrógrada | inclui:\n82000158 | Apicetomia multirradiculares com obturação retrógrada | inclui:\n82000166 | Apicetomia multirradiculares sem obturação retrógrada | inclui:\n82000174 | Apicetomia unirradiculares com obturação retrógrada | inclui:\n82000182 | Apicetomia unirradiculares sem obturação retrógrada | inclui:\n82000190 | Aprofundamento/aumento de vestíbulo | inclui:\n82000212 | Aumento de coroa clínica | inclui:\n82000280 | Biópsia de maxila | inclui:\n82000298 | Bridectomia | inclui:\n82000301 | Bridotomia | inclui:\n82000336 | Cirurgia odontológica a retalho | inclui:\n82000344 | Cirurgia odontológica com aplicação de aloenxertos | inclui:\n82000352 | Cirurgia para exostose maxilar | inclui:\n82000360 | Cirurgia para torus mandibular – bilateral | inclui:\n82000387 | Cirurgia para torus mandibular – unilateral | inclui:\n82000395 | Cirurgia para torus palatino | inclui:\n82000417 | Cirurgia periodontal a retalho | inclui:\n82000441 | Coleta de raspado em lesões ou sítios específicos da região buco-maxilo-facial | inclui:\n82000468 | Controle de hemorragia com aplicação de agente hemostático em região buco-maxilo-facial | inclui:\n82000484 | Controle de hemorragia sem aplicação de agente hemostático em região buco-maxilo-facial | inclui:\n82000506 | Controle pós-operatório em odontologia | inclui:\n82000522 | Criocirurgia de neoplasias da região buco-maxilo-facial | inclui:\n82000549 | Crioterapia ou termoterapia em odontologia | inclui:\n82000557 | Cunha proximal | inclui:\n82000581 | Enxerto com osso autógeno da linha oblíqua | inclui:\n82000603 | Enxerto com osso autógeno do mento | inclui:\n82000620 | Enxerto com osso liofilizado | inclui:\n82000646 | Enxerto conjuntivo subepitelial | inclui:\n82000662 | Enxerto gengival livre | inclui:\n82000689 | Enxerto pediculado | inclui:\n82000700 | Estabilização de paciente por meio de contenção física e/ou mecânica | inclui:\n82000743 | Exérese de lipoma na região buco-maxilo-facial | inclui:\n82000778 | Exérese ou excisão de cálculo salivar | inclui:\n82000786 | Exérese ou excisão de cistos odontológicos | inclui:\n82000794 | Exérese ou excisão de mucocele | inclui:\n82000808 | Exérese ou excisão de rânula | inclui:\n82000816 | Exodontia a retalho | inclui: sindesmotomia, luxação, avulsão, sutura simples\n82000832 | Exodontia de permanente por indicação ortodôntica/protética | inclui: sindesmotomia, luxação, avulsão, sutura simples\n82000859 | Exodontia de raiz residual | inclui: sindesmotomia, luxação, avulsão, sutura simples\n82000875 | Exodontia simples de permanente | inclui: sindesmotomia, luxação, avulsão, sutura simples\n82000883 | Frenulectomia labial | inclui:\n82000891 | Frenulectomia lingual | inclui:\n82000905 | Frenulotomia labial | inclui:\n82000913 | Frenulotomia lingual | inclui:\n82000921 | Gengivectomia | inclui:\n82000948 | Gengivoplastia | inclui:\n82000964 | Implante ortodôntico | inclui:\n82000980 | Implante ósseo integrado | inclui:\n82001006 | Implante Zigomático | inclui:\n82001022 | Incisão e Drenagem extra-oral de abscesso, hematoma e/ou flegmão da região buco-maxilo-facial | inclui:\n82001030 | Incisão e Drenagem intra-oral de abscesso, hematoma e/ou flegmão da região buco-maxilo-facial | inclui:\n82001049 | Levantamento do seio maxilar com osso autógeno | inclui:\n82001057 | Levantamento do seio maxilar com osso homólogo | inclui:\n82001065 | Levantamento do seio maxilar com osso liofilizado | inclui:\n82001073 | Odonto-secção | inclui:\n82001103 | Punção aspirativa na região buco-maxilo-facial | inclui:\n82001120 | Punção aspirativa orientada por imagem na região buco-maxilo-facial | inclui:\n82001138 | Reabertura - colocação de cicatrizador | inclui:\n82001170 | Redução cruenta de fratura alvéolo dentária | inclui:\n82001189 | Redução incruenta de fratura alvéolo dentária | inclui:\n82001197 | Redução simples de luxação de Articulação Têmporo-mandibular (ATM) | inclui:\n82001219 | Reeducação e/ou reabilitação de distúrbio buco-maxilo-facial | inclui:\n82001235 | Reeducação e/ou reabilitação de sequela em traumatismo buco-maxilo-facial | inclui:\n82001243 | Regeneração tecidual guiada – RTG | inclui:\n82001251 | Reimplante dentário com contenção | inclui:\n82001286 | Remoção de dentes inclusos / impactados | inclui:\n82001294 | Remoção de dentes semi-inclusos / impactados | inclui:\n82001308 | Remoção de dreno extra-oral | inclui:\n82001316 | Remoção de dreno intra-oral | inclui:\n82001324 | Remoção de implante dentário não ósseo integrado | inclui:\n82001332 | Remoção de implante dentário ósseo integrado no seio maxilar | inclui:\n82001367 | Remoção de odontoma | inclui:\n82001375 | Remoção de tamponamento nasal | inclui:\n82001391 | Retirada de corpo estranho oroantral ou oronasal da região buco-maxilo-facial | inclui:\n82001413 | Retirada de corpo estranho subcutâneo ou submucoso da região buco-maxilo-facial | inclui:\n82001430 | Retirada dos meios de fixação da região buco-maxilo-facial | inclui:\n82001448 | Sedação consciente com óxido nitroso e oxigênio em odontologia | inclui:\n82001456 | Sedação medicamentosa ambulatorial em odontologia | inclui:\n82001464 | Sepultamento radicular | inclui:\n82001499 | Sutura de ferida em região buco-maxilo-facial | inclui:\n82001502 | Tracionamento cirúrgico com finalidade ortodôntica | inclui:\n82001510 | Tratamento cirúrgico das fístulas buco nasal | inclui:\n82001529 | Tratamento cirúrgico das fístulas buco sinusal | inclui:\n82001545 | Tratamento cirúrgico de bridas constritivas da região buco-maxilo-facial | inclui:\n82001553 | Tratamento cirúrgico de hiperplasias de tecidos moles na região buco-maxilo-facial | inclui:\n82001588 | Tratamento cirúrgico de hiperplasias de tecidos ósseos/cartilaginosos na região buco-maxilo-facial | inclui:\n82001596 | Tratamento cirúrgico de tumores benignos de tecidos ósseos/cartilaginosos na região buco-maxilo-facial | inclui:\n82001618 | Tratamento cirúrgico dos tumores benignos de tecidos moles na região buco-maxilo-facial | inclui:\n82001634 | Tratamento Cirúrgico para tumores odontogênicos benignos – sem reconstrução | inclui:\n82001642 | Tratamento conservador de luxação da articulação têmporo-mandibular - ATM | inclui:\n82001650 | Tratamento de alveolite | inclui:\n82001669 | Tratamento odontológico regenerativo com enxerto de osso autógeno | inclui:\n82001685 | Tunelização | inclui:\n82001707 | Ulectomia | inclui:\n82001715 | Ulotomia | inclui:\n82001723 | Aplicação de laser pós cirúrgico | inclui:\n82001731 | Exodontia de semi-incluso/impactado supra numerário | inclui: sindesmotomia, luxação, avulsão, sutura simples\n82001740 | Exodontia de incluso/impactado supra numerário | inclui: sindesmotomia, luxação, avulsão, sutura simples\n82001758 | Marsupialização de cistos odontológicos | inclui:\n82001766 | Placa de contenção cirúrgica | inclui:\n85100013 | Capeamento pulpar direto | inclui:\n85100021 | Clareamento dentário caseiro | inclui:\n85100030 | Clareamento dentário de consultório | inclui:\n85100048 | Colagem de fragmentos dentários | inclui:\n85100056 | Curativo de demora em endodontia | inclui:\n85100064 | Faceta direta em resina fotopolimerizável | inclui:\n85100072 | Placa de Acetato para Clareamento Caseiro | inclui:\n85100080 | Restauração atraumática em dente permanente | inclui: remoção de cárie, proteção pulpar, restauração\n85100099 | Restauração de amálgama  - 1 face | inclui: remoção de cárie, proteção pulpar, restauração\n85100102 | Restauração de amálgama - 2 faces | inclui: remoção de cárie, proteção pulpar, restauração\n85100110 | Restauração de amálgama - 3 faces | inclui: remoção de cárie, proteção pulpar, restauração\n85100129 | Restauração de amálgama - 4 faces | inclui: remoção de cárie, proteção pulpar, restauração\n85100137 | Restauração em ionômero de vidro - 1 face | inclui: remoção de cárie, proteção pulpar, restauração\n85100145 | Restauração em ionômero de vidro - 2 faces | inclui: remoção de cárie, proteção pulpar, restauração\n85100153 | Restauração em ionômero de vidro - 3 faces | inclui: remoção de cárie, proteção pulpar, restauração\n85100161 | Restauração em ionômero de vidro - 4 faces | inclui: remoção de cárie, proteção pulpar, restauração\n85100170 | Restauração em resina (indireta) - Inlay | inclui: remoção de cárie, proteção pulpar, restauração\n85100196 | Restauração em resina fotopolimerizável  1 face | inclui: remoção de cárie, proteção pulpar, restauração\n85100200 | Restauração em resina fotopolimerizável  2 faces | inclui: remoção de cárie, proteção pulpar, restauração\n85100218 | Restauração em resina fotopolimerizável  3 faces | inclui: remoção de cárie, proteção pulpar, restauração\n85100226 | Restauração em resina fotopolimerizável  4 faces | inclui: remoção de cárie, proteção pulpar, restauração\n85100234 | Tratamento de fluorose - microabrasão | inclui:\n85100242 | Adequação do meio bucal | inclui:\n85100250 | Aplicação de laser terapêutico | inclui:\n85100269 | Dessensibilização dentinária | inclui:\n81000014 | Condicionamento em Odontologia | inclui:\n81000030 | Consulta odontológica | inclui:\n81000049 | Consulta odontológica de Urgência | inclui:\n81000057 | Consulta odontológica de Urgência 24 hs | inclui:\n81000065 | Consulta odontológica inicial | inclui:\n81000073 | Consulta odontológica para avaliação técnica de auditoria | inclui:\n81000090 | Consulta para Técnica de Clareamento Dentário Caseiro | inclui:\n81000111 | Diagnóstico anatomopatológico em citologia esfoliativa na região buco-maxilo-facial | inclui:\n81000138 | Diagnóstico anatomopatológico em material de biópsia na região buco-maxilo-facial | inclui:\n81000154 | Diagnóstico anatomopatológico em peça cirúrgica na região buco-maxilo-facial | inclui:\n81000170 | Diagnóstico anatomopatológico em punção na região buco-maxilo-facial | inclui:\n81000189 | Diagnóstico e planejamento para tratamento odontológico | inclui:\n81000197 | Diagnóstico e tratamento de estomatite herpética | inclui:\n81000200 | Diagnóstico e tratamento de estomatite por candidose | inclui:\n81000219 | Diagnóstico e tratamento de halitose | inclui:\n81000235 | Diagnóstico e tratamento de xerostomia | inclui:\n81000243 | Diagnóstico por meio de enceramento | inclui:\n81000260 | Diagnóstico por meio de procedimentos laboratoriais | inclui:\n81000278 | Fotografia | inclui:\n81000294 | Levantamento Radiográfico (Exame Radiodôntico) | inclui:\n81000308 | Modelos ortodônticos | inclui:\n81000324 | Radiografia antero-posterior | inclui:\n81000340 | Radiografia da ATM | inclui:\n81000367 | Radiografia da mão e punho - carpal | inclui:\n81000375 | Radiografia interproximal - bite-wing | inclui:\n81000405 | Radiografia panorâmica de mandíbula/maxila (ortopantomografia) | inclui:\n81000413 | Radiografia panorâmica de mandíbula/maxila (ortopantomografia) com traçado para implantes | inclui:\n81000421 | Radiografia periapical | inclui:\n81000430 | Radiografia póstero-anterior | inclui:\n81000456 | Slide | inclui:\n81000472 | Telerradiografia | inclui:\n81000480 | Telerradiografia com traçado cefalométrico | inclui:\n81000510 | Tomografia computadorizada por feixe cônico – cone beam | inclui:\n81000529 | Tomografia convencional – linear ou multi-direcional | inclui:\n81000537 | Traçado Cefalométrico | inclui:\n81000545 | Diagnóstico e tratamento de trismo | inclui:\n81000553 | Documentação odontológica em mídia digital | inclui:\n81000561 | Radiografia lateral corpo da mandíbula | inclui:\n81000570 | Técnica de localização radiográfica | inclui:\n85200018 | Clareamento de dente desvitalizado | inclui:\n85200026 | Preparo para núcleo intrarradicular | inclui:\n85200034 | Pulpectomia | inclui:\n85200042 | Pulpotomia | inclui:\n85200050 | Remoção de corpo estranho intracanal | inclui:\n85200069 | Remoção de material obturador intracanal para retratamento endodôntico | inclui: abertura coronária, preparo químico-mecânico, obturação ou curativo de demora quando sessão única\n85200077 | Remoção de núcleo intrarradicular | inclui:\n85200085 | Restauração temporária / tratamento expectante | inclui:\n85200093 | Retratamento endodôntico birradicular | inclui: abertura coronária, preparo químico-mecânico, obturação ou curativo de demora quando sessão única\n85200107 | Retratamento endodôntico multirradicular | inclui: abertura coronária, preparo químico-mecânico, obturação ou curativo de demora quando sessão única\n85200115 | Retratamento endodôntico unirradicular | inclui: abertura coronária, preparo químico-mecânico, obturação ou curativo de demora quando sessão única\n85200123 | Tratamento de perfuração endodôntica | inclui:\n85200131 | Tratamento endodôndico de dente com rizogênese incompleta | inclui: abertura coronária, preparo químico-mecânico, obturação ou curativo de demora quando sessão única\n85200140 | Tratamento endodôntico birradicular | inclui: abertura coronária, preparo químico-mecânico, obturação ou curativo de demora quando sessão única\n85200158 | Tratamento endodôntico multirradicular | inclui: abertura coronária, preparo químico-mecânico, obturação ou curativo de demora quando sessão única\n85200166 | Tratamento endodôntico unirradicular | inclui: abertura coronária, preparo químico-mecânico, obturação ou curativo de demora quando sessão única\n85200174 | Curativo endodôntico em situação de urgência | inclui:\n85200182 | Curetagem apical | inclui:\n85500011 | Coroa provisória sobre implante | inclui:\n85500020 | Coroa provisória sobre implante com carga imediata | inclui:\n85500038 | Coroa total metalo cerâmica sobre implante | inclui:\n85500046 | Coroa total metalo plástica sobre implante – cerômero | inclui:\n85500054 | Coroa total metalo plástica sobre implante – resina acrílica | inclui:\n85500062 | Guia cirúrgico para implante | inclui:\n85500070 | Intermediário protético (para implantes) | inclui:\n85500089 | Manutenção de prótese sobre implantes | inclui:\n85500097 | Overdenture barra clipe ou o'ring sobre dois implantes | inclui:\n85500100 | Overdenture barra clipe ou o'ring sobre quatro ou mais implantes | inclui:\n85500119 | Overdenture barra clipe ou o'ring sobre três implantes | inclui:\n85500127 | Prótese parcial fixa implanto suportada | inclui:\n85500135 | Prótese parcial fixa provisória em carga imediata | inclui:\n85500143 | Protocolo Branemark em carga imediata para 4 implantes - parte protética | inclui:\n85500151 | Protocolo Branemark em carga imediata para 5 implantes - parte protética | inclui:\n85500160 | Protocolo Branemark para 4 implantes | inclui:\n85500178 | Protocolo Branemark para 5 implantes | inclui:\n85500186 | Protocolo Branemark provisório para 4 implantes | inclui:\n85500194 | Protocolo Branemark provisório para 5 implantes | inclui:\n85500208 | Barra clipe | inclui:\n85500216 | Plasma rico em plaquetas (PRP) | inclui:\n85500224 | Tratamento de perimplantite por implante | inclui:\n83000020 | Coroa de acetato em dente decíduo | inclui:\n83000046 | Coroa de aço em dente decíduo | inclui:\n83000062 | Coroa de policarbonato em dente decíduo | inclui:\n83000089 | Exodontia simples de decíduo | inclui:\n83000097 | Mantenedor de espaço fixo | inclui:\n83000100 | Mantenedor de espaço removível | inclui:\n83000127 | Pulpotomia em dente decíduo | inclui:\n83000135 | Restauração atraumática em dente decíduo | inclui:\n83000151 | Tratamento endodôntico em dente decíduo | inclui:\n86000012 | Aletas Gomes | inclui:\n86000020 | Aparelho de Klammt | inclui:\n86000039 | Aparelho de protração mandibular -  APM | inclui:\n86000047 | Aparelho de Thurow | inclui:\n86000055 | Aparelho extra-bucal | inclui:\n86000063 | Aparelho ortodôntico fixo estético | inclui:\n86000080 | Aparelho ortodôntico fixo estético parcial | inclui:\n86000098 | Aparelho ortodôntico fixo metálico | inclui:\n86000110 | Aparelho ortodôntico fixo metálico parcial | inclui:\n86000128 | Aparelho removível com alças bionator invertida ou de Escheler | inclui:\n86000144 | Arco lingual | inclui:\n86000152 | Barra transpalatina fixa | inclui:\n86000160 | Barra transpalatina removível | inclui:\n86000179 | Bionator de Balters | inclui:\n86000187 | Blocos geminados de Clark – twinblock | inclui:\n86000195 | Botão de Nance | inclui:\n86000209 | Contenção fixa por arcada, em ortodontia | inclui:\n86000225 | Disjuntor palatino - Hirax | inclui:\n86000233 | Disjuntor palatino - Macnamara | inclui:\n86000241 | Distalizador com mola nitinol | inclui:\n86000250 | Distalizador de Hilgers | inclui:\n86000268 | Distalizador Distal Jet | inclui:\n86000276 | Distalizador Pendulo/Pendex | inclui:\n86000284 | Distalizador tipo Jones Jig | inclui:\n86000292 | Documentação eletromiográfica | inclui:\n86000306 | Gianelly | inclui:\n86000314 | Grade palatina fixa | inclui:\n86000322 | Grade palatina removível | inclui:\n86000330 | Herbst encapsulado | inclui:\n86000357 | Manutenção de aparelho ortodôntico - aparelho fixo | inclui:\n86000365 | Manutenção de aparelho ortodôntico - aparelho ortopédico | inclui:\n86000373 | Manutenção de aparelho ortodôntico - aparelho removível | inclui:\n86000381 | Máscara facial – Delaire e Tração Reversa | inclui:\n86000390 | Mentoneira | inclui:\n86000403 | Modelador elástico de Bimler | inclui:\n86000411 | Monobloco | inclui:\n86000420 | Obtenção de modelos gnatostáticos de Planas | inclui:\n86000438 | Pistas diretas de Planas - superior e inferior | inclui:\n86000446 | Pistas indiretas de Planas | inclui:\n86000454 | Placa de distalização de molares | inclui:\n86000462 | Placa de Hawley | inclui:\n86000470 | Placa de Hawley - com torno expansor | inclui:\n86000489 | Placa de mordida ortodôntica | inclui:\n86000497 | Placa de Schwarz | inclui:\n86000500 | Placa de verticalização de caninos | inclui:\n86000519 | Placa dupla de Sanders | inclui:\n86000527 | Placa encapsulada de Maurício | inclui:\n86000535 | Placa lábio-ativa | inclui:\n86000543 | Plano anterior fixo | inclui:\n86000551 | Plano inclinado | inclui:\n86000560 | Quadrihélice | inclui:\n86000578 | Regulador de função de Frankel | inclui:\n86000586 | Simões Network | inclui:\n86000594 | Splinter | inclui:\n86000608 | Placa de contenção ortodôntica | inclui:\n86000616 | Recolocação de mantenedor de espaço | inclui:\n85000787 | Imobilização dentária em dentes decíduos | inclui:\n87000016 | Atividade educativa em odontologia para pais e/ou cuidadores de pacientes com necessidades especiais | inclui:\n87000024 | Atividade educativa para pais e/ou cuidadores | inclui:\n87000032 | Condicionamento em odontologia para pacientes com necessidades especiais | inclui:\n87000040 | Coroa de acetato em dente permanente | inclui:\n87000059 | Coroa de aço em dente permanente | inclui:\n87000067 | Coroa de policarbonato em dente permanente | inclui:\n87000148 | Estabilização por meio de contenção física e/ou mecânica em pacientes com necessidades especiais em odontologia | inclui:\n87000164 | Sedação consciente com óxido nitroso e oxigênio em pacientes com necessidades especiais em odontologia | inclui:\n87000180 | Sedação medicamentosa ambulatorial em pacientes com necessidades especiais em odontologia | inclui:\n87000199 | Colocação de aparelho ortodôntico removível | inclui:\n85300012 | Dessensibilização dentária | inclui:\n85300020 | Imobilização dentária em dentes permanentes | inclui:\n85300039 | Raspagem sub-gengival/alisamento radicular | inclui: raspagem supra e subgengival, polimento\n85300047 | Raspagem supra-gengival | inclui: raspagem supra e subgengival, polimento\n85300055 | Remoção dos fatores de retenção do Biofilme Dental (Placa Bacteriana) | inclui:\n85300063 | Tratamento de abscesso periodontal agudo | inclui:\n85300071 | Tratamento de gengivite necrosante aguda - GNA | inclui:\n85300080 | Tratamento de pericoronarite | inclui:\n85300098 | Manutenção periodontal | inclui:\n85300101 | Tracionamento de raiz residual | inclui:\n84000015 | Aparelho protetor bucal | inclui:\n84000031 | Aplicação de cariostático | inclui:\n84000058 | Aplicação de selante - técnica invasiva | inclui:\n84000074 | Aplicação de selante de fóssulas e fissuras | inclui:\n84000090 | Aplicação tópica de flúor | inclui:\n84000112 | Aplicação tópica de verniz fluoretado | inclui:\n84000139 | Atividade educativa em saúde bucal | inclui:\n84000163 | Controle de biofilme (placa bacteriana) | inclui:\n84000171 | Controle de cárie incipiente | inclui:\n84000198 | Profilaxia: polimento coronário | inclui: remoção de placa, polimento coronário, orientação\n84000201 | Remineralização | inclui:\n84000228 | Teste de capacidade tampão da saliva | inclui:\n84000236 | Teste de contagem microbiológica | inclui:\n84000252 | Teste de PH salivar | inclui:\n85400017 | Ajuste Oclusal por acréscimo | inclui:\n85400025 | Ajuste Oclusal por desgaste seletivo | inclui:\n85400033 | Conserto em prótese parcial removível (em consultório e em laboratório) | inclui:\n85400041 | Conserto em prótese parcial removível (exclusivamente em consultório) | inclui:\n85400050 | Conserto em prótese total (em consultório e em laboratório) | inclui:\n85400068 | Conserto em prótese total (exclusivamente em consultório) | inclui:\n85400076 | Coroa provisória com pino | inclui:\n85400084 | Coroa provisória sem pino | inclui:\n85400092 | Coroa total acrílica prensada | inclui:\n85400106 | Coroa total em cerâmica pura | inclui:\n85400114 | Coroa total em cerômero | inclui:\n85400122 | Coroa total livre de metal (metalfree) sobre implante - cerâmica | inclui:\n85400130 | Coroa total livre de metal (metalfree) sobre implante - cerômero | inclui:\n85400149 | Coroa total metálica | inclui:\n85400157 | Coroa total metalo cerâmica | inclui:\n85400165 | Coroa total metalo plástica – cerômero | inclui:\n85400173 | Coroa total metalo plástica – resina acrílica | inclui:\n85400181 | Faceta em cerâmica pura | inclui:\n85400190 | Faceta em cerômero | inclui:\n85400203 | Guia cirúrgico para prótese total imediata | inclui:\n85400211 | Núcleo de preenchimento | inclui:\n85400220 | Núcleo metálico fundido | inclui:\n85400238 | Onlay de Resina Indireta | inclui:\n85400246 | Órtese miorrelaxante (placa oclusal estabilizadora) | inclui:\n85400254 | Órtese reposicionadora (placa oclusal reposicionadora) | inclui:\n85400262 | Pino pré fabricado | inclui:\n85400270 | Placa oclusal resiliente | inclui:\n85400289 | Prótese fixa adesiva direta (provisória) | inclui:\n85400297 | Prótese fixa adesiva em cerômero livre de metal (metal free) | inclui:\n85400300 | Prótese fixa adesiva indireta em metalo cerâmica | inclui:\n85400319 | Prótese fixa adesiva indireta em metalo plástica | inclui:\n85400327 | Prótese parcial fixa em cerômero livre de metal (metal free) | inclui:\n85400335 | Prótese parcial fixa em metalo cerâmica | inclui:\n85400343 | Prótese parcial fixa em metalo plástica | inclui:\n85400351 | Prótese parcial fixa In Ceran livre de metal (metal free) | inclui:\n85400360 | Prótese parcial fixa provisória | inclui:\n85400378 | Prótese parcial removível com encaixes de precisão ou de semi precisão | inclui:\n85400386 | Prótese parcial removível com grampos bilateral | inclui:\n85400394 | Prótese parcial removível provisória em acrílico com ou sem grampos | inclui:\n85400408 | Prótese total | inclui:\n85400416 | Prótese total imediata | inclui:\n85400424 | Prótese total incolor | inclui:\n85400432 | Provisório para Faceta | inclui:\n85400440 | Provisório para Inlay/Onlay | inclui:\n85400459 | Provisório para Restauração metálica fundida | inclui:\n85400467 | Recimentação de trabalhos protéticos | inclui:\n85400475 | Reembasamento de coroa provisória | inclui:\n85400483 | Reembasamento de prótese total ou parcial - imediato (em consultório) | inclui:\n85400491 | Reembasamento de prótese total ou parcial - mediato (em laboratório) | inclui:\n85400505 | Remoção de trabalho protético | inclui:\n85400513 | Restauração em cerâmica pura - inlay | inclui:\n85400521 | Restauração em cerâmica pura - onlay | inclui:\n85400530 | Restauração em cerômero - onlay | inclui:\n85400548 | Restauração em cerômero - inlay | inclui:\n85400556 | Restauração metálica fundida | inclui:\n85400564 | Prótese total imediata sobre implantes | inclui:\n85400572 | Coroa 3/4 ou 4/5 | inclui:\n85400580 | JIG ou Front plato - órtese reposicionadora | inclui:\n85400599 | Planejamento em prótese | inclui:\n85400602 | Ponto de solda | inclui:\n85400610 | Prótese total caracterizada | inclui:\n\nNOTA: Curativo de demora (85100056) é faturável SEPARADO do canal quando a obturação não foi concluída na mesma sessão. Anestesia NÃO é faturável separadamente. Raio-x periapical (81000421) É faturável separadamente quando realizado.";

/** codigo_tuss -> descrição oficial + categoria. Lookup exato, sem RAG. */
export const TUSS_INDEX: Record<string, TussDataEntry> = {
  "82000026": {
    "descricao": "Acompanhamento de tratamento/procedimento cirúrgico em odontologia",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000034": {
    "descricao": "Alveoloplastia",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000050": {
    "descricao": "Amputação radicular com obturação retrógrada",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000069": {
    "descricao": "Amputação radicular sem obturação retrógrada",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000077": {
    "descricao": "Apicetomia birradiculares com obturação retrógrada",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000085": {
    "descricao": "Apicetomia birradiculares sem obturação retrógrada",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000158": {
    "descricao": "Apicetomia multirradiculares com obturação retrógrada",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000166": {
    "descricao": "Apicetomia multirradiculares sem obturação retrógrada",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000174": {
    "descricao": "Apicetomia unirradiculares com obturação retrógrada",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000182": {
    "descricao": "Apicetomia unirradiculares sem obturação retrógrada",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000190": {
    "descricao": "Aprofundamento/aumento de vestíbulo",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000212": {
    "descricao": "Aumento de coroa clínica",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000280": {
    "descricao": "Biópsia de maxila",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000298": {
    "descricao": "Bridectomia",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000301": {
    "descricao": "Bridotomia",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000336": {
    "descricao": "Cirurgia odontológica a retalho",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000344": {
    "descricao": "Cirurgia odontológica com aplicação de aloenxertos",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000352": {
    "descricao": "Cirurgia para exostose maxilar",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000360": {
    "descricao": "Cirurgia para torus mandibular – bilateral",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000387": {
    "descricao": "Cirurgia para torus mandibular – unilateral",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000395": {
    "descricao": "Cirurgia para torus palatino",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000417": {
    "descricao": "Cirurgia periodontal a retalho",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000441": {
    "descricao": "Coleta de raspado em lesões ou sítios específicos da região buco-maxilo-facial",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000468": {
    "descricao": "Controle de hemorragia com aplicação de agente hemostático em região buco-maxilo-facial",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000484": {
    "descricao": "Controle de hemorragia sem aplicação de agente hemostático em região buco-maxilo-facial",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000506": {
    "descricao": "Controle pós-operatório em odontologia",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000522": {
    "descricao": "Criocirurgia de neoplasias da região buco-maxilo-facial",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000549": {
    "descricao": "Crioterapia ou termoterapia em odontologia",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000557": {
    "descricao": "Cunha proximal",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000581": {
    "descricao": "Enxerto com osso autógeno da linha oblíqua",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000603": {
    "descricao": "Enxerto com osso autógeno do mento",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000620": {
    "descricao": "Enxerto com osso liofilizado",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000646": {
    "descricao": "Enxerto conjuntivo subepitelial",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000662": {
    "descricao": "Enxerto gengival livre",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000689": {
    "descricao": "Enxerto pediculado",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000700": {
    "descricao": "Estabilização de paciente por meio de contenção física e/ou mecânica",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000743": {
    "descricao": "Exérese de lipoma na região buco-maxilo-facial",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000778": {
    "descricao": "Exérese ou excisão de cálculo salivar",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000786": {
    "descricao": "Exérese ou excisão de cistos odontológicos",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000794": {
    "descricao": "Exérese ou excisão de mucocele",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000808": {
    "descricao": "Exérese ou excisão de rânula",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000816": {
    "descricao": "Exodontia a retalho",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000832": {
    "descricao": "Exodontia de permanente por indicação ortodôntica/protética",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000859": {
    "descricao": "Exodontia de raiz residual",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000875": {
    "descricao": "Exodontia simples de permanente",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000883": {
    "descricao": "Frenulectomia labial",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000891": {
    "descricao": "Frenulectomia lingual",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000905": {
    "descricao": "Frenulotomia labial",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000913": {
    "descricao": "Frenulotomia lingual",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000921": {
    "descricao": "Gengivectomia",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000948": {
    "descricao": "Gengivoplastia",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000964": {
    "descricao": "Implante ortodôntico",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82000980": {
    "descricao": "Implante ósseo integrado",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001006": {
    "descricao": "Implante Zigomático",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001022": {
    "descricao": "Incisão e Drenagem extra-oral de abscesso, hematoma e/ou flegmão da região buco-maxilo-facial",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001030": {
    "descricao": "Incisão e Drenagem intra-oral de abscesso, hematoma e/ou flegmão da região buco-maxilo-facial",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001049": {
    "descricao": "Levantamento do seio maxilar com osso autógeno",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001057": {
    "descricao": "Levantamento do seio maxilar com osso homólogo",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001065": {
    "descricao": "Levantamento do seio maxilar com osso liofilizado",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001073": {
    "descricao": "Odonto-secção",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001103": {
    "descricao": "Punção aspirativa na região buco-maxilo-facial",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001120": {
    "descricao": "Punção aspirativa orientada por imagem na região buco-maxilo-facial",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001138": {
    "descricao": "Reabertura - colocação de cicatrizador",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001170": {
    "descricao": "Redução cruenta de fratura alvéolo dentária",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001189": {
    "descricao": "Redução incruenta de fratura alvéolo dentária",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001197": {
    "descricao": "Redução simples de luxação de Articulação Têmporo-mandibular (ATM)",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001219": {
    "descricao": "Reeducação e/ou reabilitação de distúrbio buco-maxilo-facial",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001235": {
    "descricao": "Reeducação e/ou reabilitação de sequela em traumatismo buco-maxilo-facial",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001243": {
    "descricao": "Regeneração tecidual guiada – RTG",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001251": {
    "descricao": "Reimplante dentário com contenção",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001286": {
    "descricao": "Remoção de dentes inclusos / impactados",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001294": {
    "descricao": "Remoção de dentes semi-inclusos / impactados",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001308": {
    "descricao": "Remoção de dreno extra-oral",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001316": {
    "descricao": "Remoção de dreno intra-oral",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001324": {
    "descricao": "Remoção de implante dentário não ósseo integrado",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001332": {
    "descricao": "Remoção de implante dentário ósseo integrado no seio maxilar",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001367": {
    "descricao": "Remoção de odontoma",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001375": {
    "descricao": "Remoção de tamponamento nasal",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001391": {
    "descricao": "Retirada de corpo estranho oroantral ou oronasal da região buco-maxilo-facial",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001413": {
    "descricao": "Retirada de corpo estranho subcutâneo ou submucoso da região buco-maxilo-facial",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001430": {
    "descricao": "Retirada dos meios de fixação da região buco-maxilo-facial",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001448": {
    "descricao": "Sedação consciente com óxido nitroso e oxigênio em odontologia",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001456": {
    "descricao": "Sedação medicamentosa ambulatorial em odontologia",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001464": {
    "descricao": "Sepultamento radicular",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001499": {
    "descricao": "Sutura de ferida em região buco-maxilo-facial",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001502": {
    "descricao": "Tracionamento cirúrgico com finalidade ortodôntica",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001510": {
    "descricao": "Tratamento cirúrgico das fístulas buco nasal",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001529": {
    "descricao": "Tratamento cirúrgico das fístulas buco sinusal",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001545": {
    "descricao": "Tratamento cirúrgico de bridas constritivas da região buco-maxilo-facial",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001553": {
    "descricao": "Tratamento cirúrgico de hiperplasias de tecidos moles na região buco-maxilo-facial",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001588": {
    "descricao": "Tratamento cirúrgico de hiperplasias de tecidos ósseos/cartilaginosos na região buco-maxilo-facial",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001596": {
    "descricao": "Tratamento cirúrgico de tumores benignos de tecidos ósseos/cartilaginosos na região buco-maxilo-facial",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001618": {
    "descricao": "Tratamento cirúrgico dos tumores benignos de tecidos moles na região buco-maxilo-facial",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001634": {
    "descricao": "Tratamento Cirúrgico para tumores odontogênicos benignos – sem reconstrução",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001642": {
    "descricao": "Tratamento conservador de luxação da articulação têmporo-mandibular - ATM",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001650": {
    "descricao": "Tratamento de alveolite",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001669": {
    "descricao": "Tratamento odontológico regenerativo com enxerto de osso autógeno",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001685": {
    "descricao": "Tunelização",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001707": {
    "descricao": "Ulectomia",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001715": {
    "descricao": "Ulotomia",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001723": {
    "descricao": "Aplicação de laser pós cirúrgico",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001731": {
    "descricao": "Exodontia de semi-incluso/impactado supra numerário",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001740": {
    "descricao": "Exodontia de incluso/impactado supra numerário",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001758": {
    "descricao": "Marsupialização de cistos odontológicos",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "82001766": {
    "descricao": "Placa de contenção cirúrgica",
    "categoria": "Cirurgia Bucomaxilofacial"
  },
  "85100013": {
    "descricao": "Capeamento pulpar direto",
    "categoria": "Dentística e Clínica"
  },
  "85100021": {
    "descricao": "Clareamento dentário caseiro",
    "categoria": "Dentística e Clínica"
  },
  "85100030": {
    "descricao": "Clareamento dentário de consultório",
    "categoria": "Dentística e Clínica"
  },
  "85100048": {
    "descricao": "Colagem de fragmentos dentários",
    "categoria": "Dentística e Clínica"
  },
  "85100056": {
    "descricao": "Curativo de demora em endodontia",
    "categoria": "Dentística e Clínica"
  },
  "85100064": {
    "descricao": "Faceta direta em resina fotopolimerizável",
    "categoria": "Dentística e Clínica"
  },
  "85100072": {
    "descricao": "Placa de Acetato para Clareamento Caseiro",
    "categoria": "Dentística e Clínica"
  },
  "85100080": {
    "descricao": "Restauração atraumática em dente permanente",
    "categoria": "Dentística e Clínica"
  },
  "85100099": {
    "descricao": "Restauração de amálgama  - 1 face",
    "categoria": "Dentística e Clínica"
  },
  "85100102": {
    "descricao": "Restauração de amálgama - 2 faces",
    "categoria": "Dentística e Clínica"
  },
  "85100110": {
    "descricao": "Restauração de amálgama - 3 faces",
    "categoria": "Dentística e Clínica"
  },
  "85100129": {
    "descricao": "Restauração de amálgama - 4 faces",
    "categoria": "Dentística e Clínica"
  },
  "85100137": {
    "descricao": "Restauração em ionômero de vidro - 1 face",
    "categoria": "Dentística e Clínica"
  },
  "85100145": {
    "descricao": "Restauração em ionômero de vidro - 2 faces",
    "categoria": "Dentística e Clínica"
  },
  "85100153": {
    "descricao": "Restauração em ionômero de vidro - 3 faces",
    "categoria": "Dentística e Clínica"
  },
  "85100161": {
    "descricao": "Restauração em ionômero de vidro - 4 faces",
    "categoria": "Dentística e Clínica"
  },
  "85100170": {
    "descricao": "Restauração em resina (indireta) - Inlay",
    "categoria": "Dentística e Clínica"
  },
  "85100196": {
    "descricao": "Restauração em resina fotopolimerizável  1 face",
    "categoria": "Dentística e Clínica"
  },
  "85100200": {
    "descricao": "Restauração em resina fotopolimerizável  2 faces",
    "categoria": "Dentística e Clínica"
  },
  "85100218": {
    "descricao": "Restauração em resina fotopolimerizável  3 faces",
    "categoria": "Dentística e Clínica"
  },
  "85100226": {
    "descricao": "Restauração em resina fotopolimerizável  4 faces",
    "categoria": "Dentística e Clínica"
  },
  "85100234": {
    "descricao": "Tratamento de fluorose - microabrasão",
    "categoria": "Dentística e Clínica"
  },
  "85100242": {
    "descricao": "Adequação do meio bucal",
    "categoria": "Dentística e Clínica"
  },
  "85100250": {
    "descricao": "Aplicação de laser terapêutico",
    "categoria": "Dentística e Clínica"
  },
  "85100269": {
    "descricao": "Dessensibilização dentinária",
    "categoria": "Dentística e Clínica"
  },
  "81000014": {
    "descricao": "Condicionamento em Odontologia",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000030": {
    "descricao": "Consulta odontológica",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000049": {
    "descricao": "Consulta odontológica de Urgência",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000057": {
    "descricao": "Consulta odontológica de Urgência 24 hs",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000065": {
    "descricao": "Consulta odontológica inicial",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000073": {
    "descricao": "Consulta odontológica para avaliação técnica de auditoria",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000090": {
    "descricao": "Consulta para Técnica de Clareamento Dentário Caseiro",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000111": {
    "descricao": "Diagnóstico anatomopatológico em citologia esfoliativa na região buco-maxilo-facial",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000138": {
    "descricao": "Diagnóstico anatomopatológico em material de biópsia na região buco-maxilo-facial",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000154": {
    "descricao": "Diagnóstico anatomopatológico em peça cirúrgica na região buco-maxilo-facial",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000170": {
    "descricao": "Diagnóstico anatomopatológico em punção na região buco-maxilo-facial",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000189": {
    "descricao": "Diagnóstico e planejamento para tratamento odontológico",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000197": {
    "descricao": "Diagnóstico e tratamento de estomatite herpética",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000200": {
    "descricao": "Diagnóstico e tratamento de estomatite por candidose",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000219": {
    "descricao": "Diagnóstico e tratamento de halitose",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000235": {
    "descricao": "Diagnóstico e tratamento de xerostomia",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000243": {
    "descricao": "Diagnóstico por meio de enceramento",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000260": {
    "descricao": "Diagnóstico por meio de procedimentos laboratoriais",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000278": {
    "descricao": "Fotografia",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000294": {
    "descricao": "Levantamento Radiográfico (Exame Radiodôntico)",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000308": {
    "descricao": "Modelos ortodônticos",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000324": {
    "descricao": "Radiografia antero-posterior",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000340": {
    "descricao": "Radiografia da ATM",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000367": {
    "descricao": "Radiografia da mão e punho - carpal",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000375": {
    "descricao": "Radiografia interproximal - bite-wing",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000405": {
    "descricao": "Radiografia panorâmica de mandíbula/maxila (ortopantomografia)",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000413": {
    "descricao": "Radiografia panorâmica de mandíbula/maxila (ortopantomografia) com traçado para implantes",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000421": {
    "descricao": "Radiografia periapical",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000430": {
    "descricao": "Radiografia póstero-anterior",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000456": {
    "descricao": "Slide",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000472": {
    "descricao": "Telerradiografia",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000480": {
    "descricao": "Telerradiografia com traçado cefalométrico",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000510": {
    "descricao": "Tomografia computadorizada por feixe cônico – cone beam",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000529": {
    "descricao": "Tomografia convencional – linear ou multi-direcional",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000537": {
    "descricao": "Traçado Cefalométrico",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000545": {
    "descricao": "Diagnóstico e tratamento de trismo",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000553": {
    "descricao": "Documentação odontológica em mídia digital",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000561": {
    "descricao": "Radiografia lateral corpo da mandíbula",
    "categoria": "Diagnóstico e Radiologia"
  },
  "81000570": {
    "descricao": "Técnica de localização radiográfica",
    "categoria": "Diagnóstico e Radiologia"
  },
  "85200018": {
    "descricao": "Clareamento de dente desvitalizado",
    "categoria": "Endodontia"
  },
  "85200026": {
    "descricao": "Preparo para núcleo intrarradicular",
    "categoria": "Endodontia"
  },
  "85200034": {
    "descricao": "Pulpectomia",
    "categoria": "Endodontia"
  },
  "85200042": {
    "descricao": "Pulpotomia",
    "categoria": "Endodontia"
  },
  "85200050": {
    "descricao": "Remoção de corpo estranho intracanal",
    "categoria": "Endodontia"
  },
  "85200069": {
    "descricao": "Remoção de material obturador intracanal para retratamento endodôntico",
    "categoria": "Endodontia"
  },
  "85200077": {
    "descricao": "Remoção de núcleo intrarradicular",
    "categoria": "Endodontia"
  },
  "85200085": {
    "descricao": "Restauração temporária / tratamento expectante",
    "categoria": "Endodontia"
  },
  "85200093": {
    "descricao": "Retratamento endodôntico birradicular",
    "categoria": "Endodontia"
  },
  "85200107": {
    "descricao": "Retratamento endodôntico multirradicular",
    "categoria": "Endodontia"
  },
  "85200115": {
    "descricao": "Retratamento endodôntico unirradicular",
    "categoria": "Endodontia"
  },
  "85200123": {
    "descricao": "Tratamento de perfuração endodôntica",
    "categoria": "Endodontia"
  },
  "85200131": {
    "descricao": "Tratamento endodôndico de dente com rizogênese incompleta",
    "categoria": "Endodontia"
  },
  "85200140": {
    "descricao": "Tratamento endodôntico birradicular",
    "categoria": "Endodontia"
  },
  "85200158": {
    "descricao": "Tratamento endodôntico multirradicular",
    "categoria": "Endodontia"
  },
  "85200166": {
    "descricao": "Tratamento endodôntico unirradicular",
    "categoria": "Endodontia"
  },
  "85200174": {
    "descricao": "Curativo endodôntico em situação de urgência",
    "categoria": "Endodontia"
  },
  "85200182": {
    "descricao": "Curetagem apical",
    "categoria": "Endodontia"
  },
  "85500011": {
    "descricao": "Coroa provisória sobre implante",
    "categoria": "Implantodontia"
  },
  "85500020": {
    "descricao": "Coroa provisória sobre implante com carga imediata",
    "categoria": "Implantodontia"
  },
  "85500038": {
    "descricao": "Coroa total metalo cerâmica sobre implante",
    "categoria": "Implantodontia"
  },
  "85500046": {
    "descricao": "Coroa total metalo plástica sobre implante – cerômero",
    "categoria": "Implantodontia"
  },
  "85500054": {
    "descricao": "Coroa total metalo plástica sobre implante – resina acrílica",
    "categoria": "Implantodontia"
  },
  "85500062": {
    "descricao": "Guia cirúrgico para implante",
    "categoria": "Implantodontia"
  },
  "85500070": {
    "descricao": "Intermediário protético (para implantes)",
    "categoria": "Implantodontia"
  },
  "85500089": {
    "descricao": "Manutenção de prótese sobre implantes",
    "categoria": "Implantodontia"
  },
  "85500097": {
    "descricao": "Overdenture barra clipe ou o'ring sobre dois implantes",
    "categoria": "Implantodontia"
  },
  "85500100": {
    "descricao": "Overdenture barra clipe ou o'ring sobre quatro ou mais implantes",
    "categoria": "Implantodontia"
  },
  "85500119": {
    "descricao": "Overdenture barra clipe ou o'ring sobre três implantes",
    "categoria": "Implantodontia"
  },
  "85500127": {
    "descricao": "Prótese parcial fixa implanto suportada",
    "categoria": "Implantodontia"
  },
  "85500135": {
    "descricao": "Prótese parcial fixa provisória em carga imediata",
    "categoria": "Implantodontia"
  },
  "85500143": {
    "descricao": "Protocolo Branemark em carga imediata para 4 implantes - parte protética",
    "categoria": "Implantodontia"
  },
  "85500151": {
    "descricao": "Protocolo Branemark em carga imediata para 5 implantes - parte protética",
    "categoria": "Implantodontia"
  },
  "85500160": {
    "descricao": "Protocolo Branemark para 4 implantes",
    "categoria": "Implantodontia"
  },
  "85500178": {
    "descricao": "Protocolo Branemark para 5 implantes",
    "categoria": "Implantodontia"
  },
  "85500186": {
    "descricao": "Protocolo Branemark provisório para 4 implantes",
    "categoria": "Implantodontia"
  },
  "85500194": {
    "descricao": "Protocolo Branemark provisório para 5 implantes",
    "categoria": "Implantodontia"
  },
  "85500208": {
    "descricao": "Barra clipe",
    "categoria": "Implantodontia"
  },
  "85500216": {
    "descricao": "Plasma rico em plaquetas (PRP)",
    "categoria": "Implantodontia"
  },
  "85500224": {
    "descricao": "Tratamento de perimplantite por implante",
    "categoria": "Implantodontia"
  },
  "83000020": {
    "descricao": "Coroa de acetato em dente decíduo",
    "categoria": "Odontopediatria"
  },
  "83000046": {
    "descricao": "Coroa de aço em dente decíduo",
    "categoria": "Odontopediatria"
  },
  "83000062": {
    "descricao": "Coroa de policarbonato em dente decíduo",
    "categoria": "Odontopediatria"
  },
  "83000089": {
    "descricao": "Exodontia simples de decíduo",
    "categoria": "Odontopediatria"
  },
  "83000097": {
    "descricao": "Mantenedor de espaço fixo",
    "categoria": "Odontopediatria"
  },
  "83000100": {
    "descricao": "Mantenedor de espaço removível",
    "categoria": "Odontopediatria"
  },
  "83000127": {
    "descricao": "Pulpotomia em dente decíduo",
    "categoria": "Odontopediatria"
  },
  "83000135": {
    "descricao": "Restauração atraumática em dente decíduo",
    "categoria": "Odontopediatria"
  },
  "83000151": {
    "descricao": "Tratamento endodôntico em dente decíduo",
    "categoria": "Odontopediatria"
  },
  "86000012": {
    "descricao": "Aletas Gomes",
    "categoria": "Ortodontia"
  },
  "86000020": {
    "descricao": "Aparelho de Klammt",
    "categoria": "Ortodontia"
  },
  "86000039": {
    "descricao": "Aparelho de protração mandibular -  APM",
    "categoria": "Ortodontia"
  },
  "86000047": {
    "descricao": "Aparelho de Thurow",
    "categoria": "Ortodontia"
  },
  "86000055": {
    "descricao": "Aparelho extra-bucal",
    "categoria": "Ortodontia"
  },
  "86000063": {
    "descricao": "Aparelho ortodôntico fixo estético",
    "categoria": "Ortodontia"
  },
  "86000080": {
    "descricao": "Aparelho ortodôntico fixo estético parcial",
    "categoria": "Ortodontia"
  },
  "86000098": {
    "descricao": "Aparelho ortodôntico fixo metálico",
    "categoria": "Ortodontia"
  },
  "86000110": {
    "descricao": "Aparelho ortodôntico fixo metálico parcial",
    "categoria": "Ortodontia"
  },
  "86000128": {
    "descricao": "Aparelho removível com alças bionator invertida ou de Escheler",
    "categoria": "Ortodontia"
  },
  "86000144": {
    "descricao": "Arco lingual",
    "categoria": "Ortodontia"
  },
  "86000152": {
    "descricao": "Barra transpalatina fixa",
    "categoria": "Ortodontia"
  },
  "86000160": {
    "descricao": "Barra transpalatina removível",
    "categoria": "Ortodontia"
  },
  "86000179": {
    "descricao": "Bionator de Balters",
    "categoria": "Ortodontia"
  },
  "86000187": {
    "descricao": "Blocos geminados de Clark – twinblock",
    "categoria": "Ortodontia"
  },
  "86000195": {
    "descricao": "Botão de Nance",
    "categoria": "Ortodontia"
  },
  "86000209": {
    "descricao": "Contenção fixa por arcada, em ortodontia",
    "categoria": "Ortodontia"
  },
  "86000225": {
    "descricao": "Disjuntor palatino - Hirax",
    "categoria": "Ortodontia"
  },
  "86000233": {
    "descricao": "Disjuntor palatino - Macnamara",
    "categoria": "Ortodontia"
  },
  "86000241": {
    "descricao": "Distalizador com mola nitinol",
    "categoria": "Ortodontia"
  },
  "86000250": {
    "descricao": "Distalizador de Hilgers",
    "categoria": "Ortodontia"
  },
  "86000268": {
    "descricao": "Distalizador Distal Jet",
    "categoria": "Ortodontia"
  },
  "86000276": {
    "descricao": "Distalizador Pendulo/Pendex",
    "categoria": "Ortodontia"
  },
  "86000284": {
    "descricao": "Distalizador tipo Jones Jig",
    "categoria": "Ortodontia"
  },
  "86000292": {
    "descricao": "Documentação eletromiográfica",
    "categoria": "Ortodontia"
  },
  "86000306": {
    "descricao": "Gianelly",
    "categoria": "Ortodontia"
  },
  "86000314": {
    "descricao": "Grade palatina fixa",
    "categoria": "Ortodontia"
  },
  "86000322": {
    "descricao": "Grade palatina removível",
    "categoria": "Ortodontia"
  },
  "86000330": {
    "descricao": "Herbst encapsulado",
    "categoria": "Ortodontia"
  },
  "86000357": {
    "descricao": "Manutenção de aparelho ortodôntico - aparelho fixo",
    "categoria": "Ortodontia"
  },
  "86000365": {
    "descricao": "Manutenção de aparelho ortodôntico - aparelho ortopédico",
    "categoria": "Ortodontia"
  },
  "86000373": {
    "descricao": "Manutenção de aparelho ortodôntico - aparelho removível",
    "categoria": "Ortodontia"
  },
  "86000381": {
    "descricao": "Máscara facial – Delaire e Tração Reversa",
    "categoria": "Ortodontia"
  },
  "86000390": {
    "descricao": "Mentoneira",
    "categoria": "Ortodontia"
  },
  "86000403": {
    "descricao": "Modelador elástico de Bimler",
    "categoria": "Ortodontia"
  },
  "86000411": {
    "descricao": "Monobloco",
    "categoria": "Ortodontia"
  },
  "86000420": {
    "descricao": "Obtenção de modelos gnatostáticos de Planas",
    "categoria": "Ortodontia"
  },
  "86000438": {
    "descricao": "Pistas diretas de Planas - superior e inferior",
    "categoria": "Ortodontia"
  },
  "86000446": {
    "descricao": "Pistas indiretas de Planas",
    "categoria": "Ortodontia"
  },
  "86000454": {
    "descricao": "Placa de distalização de molares",
    "categoria": "Ortodontia"
  },
  "86000462": {
    "descricao": "Placa de Hawley",
    "categoria": "Ortodontia"
  },
  "86000470": {
    "descricao": "Placa de Hawley - com torno expansor",
    "categoria": "Ortodontia"
  },
  "86000489": {
    "descricao": "Placa de mordida ortodôntica",
    "categoria": "Ortodontia"
  },
  "86000497": {
    "descricao": "Placa de Schwarz",
    "categoria": "Ortodontia"
  },
  "86000500": {
    "descricao": "Placa de verticalização de caninos",
    "categoria": "Ortodontia"
  },
  "86000519": {
    "descricao": "Placa dupla de Sanders",
    "categoria": "Ortodontia"
  },
  "86000527": {
    "descricao": "Placa encapsulada de Maurício",
    "categoria": "Ortodontia"
  },
  "86000535": {
    "descricao": "Placa lábio-ativa",
    "categoria": "Ortodontia"
  },
  "86000543": {
    "descricao": "Plano anterior fixo",
    "categoria": "Ortodontia"
  },
  "86000551": {
    "descricao": "Plano inclinado",
    "categoria": "Ortodontia"
  },
  "86000560": {
    "descricao": "Quadrihélice",
    "categoria": "Ortodontia"
  },
  "86000578": {
    "descricao": "Regulador de função de Frankel",
    "categoria": "Ortodontia"
  },
  "86000586": {
    "descricao": "Simões Network",
    "categoria": "Ortodontia"
  },
  "86000594": {
    "descricao": "Splinter",
    "categoria": "Ortodontia"
  },
  "86000608": {
    "descricao": "Placa de contenção ortodôntica",
    "categoria": "Ortodontia"
  },
  "86000616": {
    "descricao": "Recolocação de mantenedor de espaço",
    "categoria": "Ortodontia"
  },
  "85000787": {
    "descricao": "Imobilização dentária em dentes decíduos",
    "categoria": "Outros"
  },
  "87000016": {
    "descricao": "Atividade educativa em odontologia para pais e/ou cuidadores de pacientes com necessidades especiais",
    "categoria": "Pacientes com Necessidades Especiais"
  },
  "87000024": {
    "descricao": "Atividade educativa para pais e/ou cuidadores",
    "categoria": "Pacientes com Necessidades Especiais"
  },
  "87000032": {
    "descricao": "Condicionamento em odontologia para pacientes com necessidades especiais",
    "categoria": "Pacientes com Necessidades Especiais"
  },
  "87000040": {
    "descricao": "Coroa de acetato em dente permanente",
    "categoria": "Pacientes com Necessidades Especiais"
  },
  "87000059": {
    "descricao": "Coroa de aço em dente permanente",
    "categoria": "Pacientes com Necessidades Especiais"
  },
  "87000067": {
    "descricao": "Coroa de policarbonato em dente permanente",
    "categoria": "Pacientes com Necessidades Especiais"
  },
  "87000148": {
    "descricao": "Estabilização por meio de contenção física e/ou mecânica em pacientes com necessidades especiais em odontologia",
    "categoria": "Pacientes com Necessidades Especiais"
  },
  "87000164": {
    "descricao": "Sedação consciente com óxido nitroso e oxigênio em pacientes com necessidades especiais em odontologia",
    "categoria": "Pacientes com Necessidades Especiais"
  },
  "87000180": {
    "descricao": "Sedação medicamentosa ambulatorial em pacientes com necessidades especiais em odontologia",
    "categoria": "Pacientes com Necessidades Especiais"
  },
  "87000199": {
    "descricao": "Colocação de aparelho ortodôntico removível",
    "categoria": "Pacientes com Necessidades Especiais"
  },
  "85300012": {
    "descricao": "Dessensibilização dentária",
    "categoria": "Periodontia"
  },
  "85300020": {
    "descricao": "Imobilização dentária em dentes permanentes",
    "categoria": "Periodontia"
  },
  "85300039": {
    "descricao": "Raspagem sub-gengival/alisamento radicular",
    "categoria": "Periodontia"
  },
  "85300047": {
    "descricao": "Raspagem supra-gengival",
    "categoria": "Periodontia"
  },
  "85300055": {
    "descricao": "Remoção dos fatores de retenção do Biofilme Dental (Placa Bacteriana)",
    "categoria": "Periodontia"
  },
  "85300063": {
    "descricao": "Tratamento de abscesso periodontal agudo",
    "categoria": "Periodontia"
  },
  "85300071": {
    "descricao": "Tratamento de gengivite necrosante aguda - GNA",
    "categoria": "Periodontia"
  },
  "85300080": {
    "descricao": "Tratamento de pericoronarite",
    "categoria": "Periodontia"
  },
  "85300098": {
    "descricao": "Manutenção periodontal",
    "categoria": "Periodontia"
  },
  "85300101": {
    "descricao": "Tracionamento de raiz residual",
    "categoria": "Periodontia"
  },
  "84000015": {
    "descricao": "Aparelho protetor bucal",
    "categoria": "Prevenção"
  },
  "84000031": {
    "descricao": "Aplicação de cariostático",
    "categoria": "Prevenção"
  },
  "84000058": {
    "descricao": "Aplicação de selante - técnica invasiva",
    "categoria": "Prevenção"
  },
  "84000074": {
    "descricao": "Aplicação de selante de fóssulas e fissuras",
    "categoria": "Prevenção"
  },
  "84000090": {
    "descricao": "Aplicação tópica de flúor",
    "categoria": "Prevenção"
  },
  "84000112": {
    "descricao": "Aplicação tópica de verniz fluoretado",
    "categoria": "Prevenção"
  },
  "84000139": {
    "descricao": "Atividade educativa em saúde bucal",
    "categoria": "Prevenção"
  },
  "84000163": {
    "descricao": "Controle de biofilme (placa bacteriana)",
    "categoria": "Prevenção"
  },
  "84000171": {
    "descricao": "Controle de cárie incipiente",
    "categoria": "Prevenção"
  },
  "84000198": {
    "descricao": "Profilaxia: polimento coronário",
    "categoria": "Prevenção"
  },
  "84000201": {
    "descricao": "Remineralização",
    "categoria": "Prevenção"
  },
  "84000228": {
    "descricao": "Teste de capacidade tampão da saliva",
    "categoria": "Prevenção"
  },
  "84000236": {
    "descricao": "Teste de contagem microbiológica",
    "categoria": "Prevenção"
  },
  "84000252": {
    "descricao": "Teste de PH salivar",
    "categoria": "Prevenção"
  },
  "85400017": {
    "descricao": "Ajuste Oclusal por acréscimo",
    "categoria": "Prótese Dentária"
  },
  "85400025": {
    "descricao": "Ajuste Oclusal por desgaste seletivo",
    "categoria": "Prótese Dentária"
  },
  "85400033": {
    "descricao": "Conserto em prótese parcial removível (em consultório e em laboratório)",
    "categoria": "Prótese Dentária"
  },
  "85400041": {
    "descricao": "Conserto em prótese parcial removível (exclusivamente em consultório)",
    "categoria": "Prótese Dentária"
  },
  "85400050": {
    "descricao": "Conserto em prótese total (em consultório e em laboratório)",
    "categoria": "Prótese Dentária"
  },
  "85400068": {
    "descricao": "Conserto em prótese total (exclusivamente em consultório)",
    "categoria": "Prótese Dentária"
  },
  "85400076": {
    "descricao": "Coroa provisória com pino",
    "categoria": "Prótese Dentária"
  },
  "85400084": {
    "descricao": "Coroa provisória sem pino",
    "categoria": "Prótese Dentária"
  },
  "85400092": {
    "descricao": "Coroa total acrílica prensada",
    "categoria": "Prótese Dentária"
  },
  "85400106": {
    "descricao": "Coroa total em cerâmica pura",
    "categoria": "Prótese Dentária"
  },
  "85400114": {
    "descricao": "Coroa total em cerômero",
    "categoria": "Prótese Dentária"
  },
  "85400122": {
    "descricao": "Coroa total livre de metal (metalfree) sobre implante - cerâmica",
    "categoria": "Prótese Dentária"
  },
  "85400130": {
    "descricao": "Coroa total livre de metal (metalfree) sobre implante - cerômero",
    "categoria": "Prótese Dentária"
  },
  "85400149": {
    "descricao": "Coroa total metálica",
    "categoria": "Prótese Dentária"
  },
  "85400157": {
    "descricao": "Coroa total metalo cerâmica",
    "categoria": "Prótese Dentária"
  },
  "85400165": {
    "descricao": "Coroa total metalo plástica – cerômero",
    "categoria": "Prótese Dentária"
  },
  "85400173": {
    "descricao": "Coroa total metalo plástica – resina acrílica",
    "categoria": "Prótese Dentária"
  },
  "85400181": {
    "descricao": "Faceta em cerâmica pura",
    "categoria": "Prótese Dentária"
  },
  "85400190": {
    "descricao": "Faceta em cerômero",
    "categoria": "Prótese Dentária"
  },
  "85400203": {
    "descricao": "Guia cirúrgico para prótese total imediata",
    "categoria": "Prótese Dentária"
  },
  "85400211": {
    "descricao": "Núcleo de preenchimento",
    "categoria": "Prótese Dentária"
  },
  "85400220": {
    "descricao": "Núcleo metálico fundido",
    "categoria": "Prótese Dentária"
  },
  "85400238": {
    "descricao": "Onlay de Resina Indireta",
    "categoria": "Prótese Dentária"
  },
  "85400246": {
    "descricao": "Órtese miorrelaxante (placa oclusal estabilizadora)",
    "categoria": "Prótese Dentária"
  },
  "85400254": {
    "descricao": "Órtese reposicionadora (placa oclusal reposicionadora)",
    "categoria": "Prótese Dentária"
  },
  "85400262": {
    "descricao": "Pino pré fabricado",
    "categoria": "Prótese Dentária"
  },
  "85400270": {
    "descricao": "Placa oclusal resiliente",
    "categoria": "Prótese Dentária"
  },
  "85400289": {
    "descricao": "Prótese fixa adesiva direta (provisória)",
    "categoria": "Prótese Dentária"
  },
  "85400297": {
    "descricao": "Prótese fixa adesiva em cerômero livre de metal (metal free)",
    "categoria": "Prótese Dentária"
  },
  "85400300": {
    "descricao": "Prótese fixa adesiva indireta em metalo cerâmica",
    "categoria": "Prótese Dentária"
  },
  "85400319": {
    "descricao": "Prótese fixa adesiva indireta em metalo plástica",
    "categoria": "Prótese Dentária"
  },
  "85400327": {
    "descricao": "Prótese parcial fixa em cerômero livre de metal (metal free)",
    "categoria": "Prótese Dentária"
  },
  "85400335": {
    "descricao": "Prótese parcial fixa em metalo cerâmica",
    "categoria": "Prótese Dentária"
  },
  "85400343": {
    "descricao": "Prótese parcial fixa em metalo plástica",
    "categoria": "Prótese Dentária"
  },
  "85400351": {
    "descricao": "Prótese parcial fixa In Ceran livre de metal (metal free)",
    "categoria": "Prótese Dentária"
  },
  "85400360": {
    "descricao": "Prótese parcial fixa provisória",
    "categoria": "Prótese Dentária"
  },
  "85400378": {
    "descricao": "Prótese parcial removível com encaixes de precisão ou de semi precisão",
    "categoria": "Prótese Dentária"
  },
  "85400386": {
    "descricao": "Prótese parcial removível com grampos bilateral",
    "categoria": "Prótese Dentária"
  },
  "85400394": {
    "descricao": "Prótese parcial removível provisória em acrílico com ou sem grampos",
    "categoria": "Prótese Dentária"
  },
  "85400408": {
    "descricao": "Prótese total",
    "categoria": "Prótese Dentária"
  },
  "85400416": {
    "descricao": "Prótese total imediata",
    "categoria": "Prótese Dentária"
  },
  "85400424": {
    "descricao": "Prótese total incolor",
    "categoria": "Prótese Dentária"
  },
  "85400432": {
    "descricao": "Provisório para Faceta",
    "categoria": "Prótese Dentária"
  },
  "85400440": {
    "descricao": "Provisório para Inlay/Onlay",
    "categoria": "Prótese Dentária"
  },
  "85400459": {
    "descricao": "Provisório para Restauração metálica fundida",
    "categoria": "Prótese Dentária"
  },
  "85400467": {
    "descricao": "Recimentação de trabalhos protéticos",
    "categoria": "Prótese Dentária"
  },
  "85400475": {
    "descricao": "Reembasamento de coroa provisória",
    "categoria": "Prótese Dentária"
  },
  "85400483": {
    "descricao": "Reembasamento de prótese total ou parcial - imediato (em consultório)",
    "categoria": "Prótese Dentária"
  },
  "85400491": {
    "descricao": "Reembasamento de prótese total ou parcial - mediato (em laboratório)",
    "categoria": "Prótese Dentária"
  },
  "85400505": {
    "descricao": "Remoção de trabalho protético",
    "categoria": "Prótese Dentária"
  },
  "85400513": {
    "descricao": "Restauração em cerâmica pura - inlay",
    "categoria": "Prótese Dentária"
  },
  "85400521": {
    "descricao": "Restauração em cerâmica pura - onlay",
    "categoria": "Prótese Dentária"
  },
  "85400530": {
    "descricao": "Restauração em cerômero - onlay",
    "categoria": "Prótese Dentária"
  },
  "85400548": {
    "descricao": "Restauração em cerômero - inlay",
    "categoria": "Prótese Dentária"
  },
  "85400556": {
    "descricao": "Restauração metálica fundida",
    "categoria": "Prótese Dentária"
  },
  "85400564": {
    "descricao": "Prótese total imediata sobre implantes",
    "categoria": "Prótese Dentária"
  },
  "85400572": {
    "descricao": "Coroa 3/4 ou 4/5",
    "categoria": "Prótese Dentária"
  },
  "85400580": {
    "descricao": "JIG ou Front plato - órtese reposicionadora",
    "categoria": "Prótese Dentária"
  },
  "85400599": {
    "descricao": "Planejamento em prótese",
    "categoria": "Prótese Dentária"
  },
  "85400602": {
    "descricao": "Ponto de solda",
    "categoria": "Prótese Dentária"
  },
  "85400610": {
    "descricao": "Prótese total caracterizada",
    "categoria": "Prótese Dentária"
  }
};
