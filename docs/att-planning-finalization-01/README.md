# ATT-PLANNING-FINALIZATION-01

Arquivo seletivo das implementa??es homologadas e da microcorre??o do Manifesto. Sem deploy.

Os quatro incrementos s?o patches de c?digo, acompanhados dos hashes das pr?-imagens e resultados. Foram reconstru?dos separadamente sobre suas pr?-imagens exatas, com compara??o SHA-256 ap?s normaliza??o LF: 25 arquivos de i18n, cinco de ferramentas, nove de recupera??o e um de Manifesto. A ?rvore DEV cont?m outras frentes anteriores ainda n?o integradas ao Git; por isso este arquivo n?o ? um checkout execut?vel nem deve substituir o DEV. N?o fazer checkout/reset desta branch sobre a ?rea de trabalho. Os patches exigem as bases indicadas; n?o aplicar cegamente em main.

Os testes em `validation/` s?o fontes aprovadas para uso junto do DEV preservado. As fixtures e demais depend?ncias continuam na ?rvore original. Um teste preexistente cont?m identificador DEV e foi exclu?do deste arquivo; somente seu hash e o motivo constam em `validation/local-only.json`. Nenhum arquivo original foi apagado.

A branch de arquivo come?a sem importar o hist?rico antigo, pois um commit local anterior cont?m identificadores DEV em relat?rios. Os hist?ricos e ?ndices originais permanecem intactos. Este procedimento preserva as entregas selecionadas sem misturar credenciais, banco, snapshots, backups, tempor?rios ou trabalhos de outras frentes.
