# Valida??o focada

## Causa e altera??o

Com 800 clientes ou mais, `planning-canvas-markers.js` usa um Canvas Leaflet no markerPane, acima do canvas das rotas no overlayPane. O canvas superior recebia os cliques inclusive fora dos marcadores; os handlers das linhas n?o eram chamados. Com seis clientes a abertura funcionava. Com 800, a prova anterior registrou zero eventos de linha e Manifesto fechado; a chamada direta abriu o mesmo Manifesto.

O SHA-256 do adaptador antes da corre??o era `20ef04248bf8d4c9fff430280fa0455424948056327c75939aa83283ffe25aa4`, id?ntico ?s c?pias anteriores a i18n e ? recupera??o. Portanto o defeito era preexistente, condicionado ao volume, sem evid?ncia de regress?o causada pela ?ltima interven??o.

A altera??o se limita a 11 linhas no renderer: cliques e duplos cliques em pixels sem marcador seguem para o renderer j? existente das rotas. Marcadores conservam prioridade; outros eventos seguem o comportamento Leaflet original. N?o houve altera??es no Manifesto, RBAC, Save, Autosave ou recupera??o.

A abertura requer contexto autenticado, v?nculo tenant/opera??o/sess?o e leitura dos recursos log?sticos. Os GETs usam bound_planning_context; escritas continuam com require_planning_edit. Nenhuma permiss?o foi ampliada.

## Evid?ncias

- 143 testes focados passaram, zero falhas: capacidades, pointer, ferramentas/Esc, recupera??o e coordenador de Save.
- Navegador isolado com 800 clientes: normal/expandido, linhas de sequ?ncia e rodovi?ria, sa?da de La?o/R?gua/Troca, prioridade do marcador, dados e dirty flag preservados, zero grava??es empresariais e zero erros nas 12 verifica??es finais, incluindo a linha rodovi?ria.
- DEV autenticado com 2.520 clientes: abertura pela linha confirmada nos layouts normal e expandido; Esc fechou o Manifesto preservando o mapa expandido. Ao final: Salvo, Save desabilitado por aus?ncia de altera??es eleg?veis, Autosave OFF preservado.
- SQLite: quick_check = ok. 43 arquivos de banco/dados inventariados privadamente antes do encerramento.
- Uma amplia??o opcional da fixture para 2.500 clientes n?o concluiu o boot sint?tico (CORE_UNAVAILABLE). N?o foi apresentada como PASS nem motivou altera??o de produto; o volume real de 2.520 foi validado separadamente no DEV autenticado.

## Retomada manual

Amanh?, confirmar com o gesto habitual do propriet?rio a abertura ap?s usar suas ferramentas na sess?o usual. A microcorre??o j? passou na prova autenticada de hoje. As homologa??es de i18n, ferramentas e recupera??o foram aceitas pelo propriet?rio nesta solicita??o; n?o foram reabertas.

Os logs completos e capturas sint?ticas ficam em `.tmp/planning-finalization-01/`, fora do Git. As capturas da sess?o autenticada n?o integram este arquivo p?blico.
