# ATT-PLANNING-FINALIZATION-01 ? encerramento

25/11/2026. Manifesto corrigido e confirmado no DEV autenticado. Nenhum deploy ou publica??o da aplica??o foi realizado.

| Frente | Resultado | Evid?ncia / limite |
|---|---|---|
| Causa raiz do Manifesto | PASS | Canvas de marcadores sobrepunha o canvas das rotas a partir de 800 clientes. Falha preexistente ?s tr?s interven??es recentes. |
| Corre??o | PASS | Onze linhas no adaptador encaminham clique/duplo clique fora dos marcadores aos handlers originais. RBAC e Manifesto interno intactos. |
| Regress?o focada | PASS | 143 testes; 12 verifica??es de navegador com 800 clientes, zero erros/escritas; DEV autenticado com 2.520 clientes nos dois layouts. |
| Git local | PARTIAL | Quatro commits seletivos verific?veis preservam as entregas; a ?rvore DEV continua com trabalhos anteriores n?o integrados. O arquivo n?o ? checkout execut?vel. |
| GitHub | PARTIAL | Arquivo Planning, Landing e Sales sincronizados. Branch original ROUTflex retida por dados DEV em relat?rios antigos; CORE sem remoto. |
| Encerramento dos servi?os | PARTIAL | Frontend/API Planning, Landing e CORE encerrados graciosamente. PostgreSQL permaneceu ativo por falta de permiss?o do Windows, sem conex?es de aplica??es. |

## Commits e branches

- `9ca7430` ? incrementos aprovados de i18n.
- `17ec307` ? incrementos aprovados das ferramentas do mapa.
- `ed9fa58` ? incrementos aprovados de recupera??o e fontes de valida??o.
- `c578e68` ? microcorre??o do Manifesto e prova final.
- O commit posterior de documenta??o registra este encerramento, sem mudan?as de produto.

Arquivo enviado: [planning/controlled-finalization-20261125](https://github.com/phillips-david98/Routflex2/tree/planning/controlled-finalization-20261125). Os patches e hashes preservam os incrementos sobre pr?-imagens espec?ficas; reconstru??es independentes conferidas por SHA-256 com LF normalizado. N?o substituir o DEV por essa branch.

Landing: [feat/tenant-administration-closure-v1](https://github.com/phillips-david98/ROUTFLEX-LANDING/tree/feat/tenant-administration-closure-v1), `078091e`. Sales: `feat/routex-visual-unificado`, `6948c23`. Os trabalhos soltos preexistentes ficaram preservados.

A branch DEV ROUTflex permanece em `3d37011`, nove commits ? frente do remoto, sem envio. O commit antigo `bfb3df9` cont?m identificadores DEV em quatro relat?rios. CORE permanece em `443120e`, branch `feat/tenant-administration-closure-v1`, sem remoto configurado. N?o houve reescrita de hist?ricos.

## Integridade e servi?os

296 arquivos frontend preexistentes comparados ao estado homologado: somente `frontend/js/planning-canvas-markers.js` mudou. O novo teste ? `frontend/tests/planning-manifest-map-ui.cjs`. ?ndice Git original preservado byte a byte. SQLite `quick_check=ok`; 43 arquivos de banco/dados permaneceram com hashes id?nticos ap?s o encerramento.

A interface autenticada terminou com estado Salvo, Save desabilitado por aus?ncia de altera??es eleg?veis, Autosave OFF preservado e sem editor aberto. PostgreSQL tinha cinco conex?es CORE ociosas, zero transa??es; ap?s encerrar CORE, zero conex?es de aplica??es. N?o foram encontrados processos Node dos testes desta sess?o. As inst?ncias tempor?rias de Edge foram fechadas pelos testes; o navegador do propriet?rio e o VS Code foram preservados.

Portas ROUTflex 8080, 8000, 5500, 3100, 3001, 5173, 3000 e 5175 sem listeners. PostgreSQL `postgresql-x64-18` permanece em 5432. `Stop-Service` e `pg_ctl stop -m smart` foram recusados pelo Windows. N?o houve t?rmino for?ado, mudan?a de permiss?es ou manipula??o de dados para contornar a recusa.

## Retomada em 26/11

1. Usar o DEV preservado em `C:\ROUTflex`, mantendo a branch atual; iniciar os servi?os pelo gerenciador: `./tools/runtime/ROUTflex.ps1 -Action Start -Services core,landing,planning-api,planning-web`. PostgreSQL j? est? ativo, salvo encerramento administrativo posterior.
2. Confirmar com o gesto habitual do propriet?rio a abertura do Manifesto pela linha ap?s La?o/R?gua/Troca. A prova autenticada de hoje j? passou nos layouts normal e expandido; n?o h? nova homologa??o abrangente exigida.
3. Em frente separada, reconciliar as altera??es antigas da ?rvore DEV para obter um checkout completo e definir o remoto CORE. A branch original com relat?rios DEV n?o deve ser enviada sem tratar essa exposi??o; n?o reescrever hist?rico compartilhado.
4. Caso queira encerrar tamb?m PostgreSQL antes da retomada, um administrador do Windows pode executar `Stop-Service postgresql-x64-18`, ap?s repetir a verifica??o de aus?ncia de outros consumidores.

Ver [VALIDATION.md](VALIDATION.md), [GIT.md](GIT.md) e [README.md](README.md) para os limites das provas e do arquivo seletivo. Logs privados, capturas sint?ticas e invent?rios detalhados permanecem em `.tmp/planning-finalization-01/`, fora dos commits.
