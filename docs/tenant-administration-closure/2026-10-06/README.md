# ROUTflex — Tenant Administration Closure V1

Data de referência: 2026-10-06, America/Sao_Paulo. Parte das evidências foi gerada após 00:00 UTC de 2026-10-07, ainda em 06/10 no Brasil.

**Implementação e testes: PASS. Encerramento integral: BLOCKED pelo backup remoto do CORE.** Não existe remote CORE determinável. O código está em commit próprio e bundle local verificado. O navegador controlável está indisponível; validação visual/funcional real não foi declarada concluída. Snapshot LIVE A/B continua PENDING.

## Arquitetura e operação

CORE continua sendo a única autoridade de tenants, identidades, memberships, roles, entitlements e seats. Control Center consome APIs de plataforma; Workspace consome APIs do tenant autenticado. Os guards consultam a autoridade persistida, sem confiar em roles, flags OWNER ou tenant informados como autoridade pelo browser.

Fluxo disponível: Super Admin cria a empresa, edita seus atributos administrativos, configura os quatro módulos e quotas, designa OWNER por e-mail e ativa o tenant. OWNER aceita o convite, entra no Workspace e administra membros, seats e roles da própria empresa. A entrega do link é manual por canal seguro; não foi introduzido serviço de e-mail.

Control Center, Workspace e convite estão servidos localmente nas portas existentes. CORE foi reiniciado isoladamente após migration/build/client Prisma, e responde na porta 3100. Nenhum login ou tenant operacional foi usado como fixture nesta fase. O push de uma branch não equivale a deploy de hospedagem.

## Lifecycle e regras

- Tenant: criação existente preservada; PATCH apenas para displayName, legalName, taxIdType, taxIdValue, primaryCountry, defaultLocale, defaultTimezone e defaultCurrency. Campos legais/fiscais opcionais podem ser limpos. ID, slug e status não são editáveis por esse PATCH. PROVISIONING/TRIAL podem ativar; ACTIVE é idempotente; SUSPENDED usa reativação; CANCELLED não ativa.
- OWNER: somente plataforma designa, usando TENANT_ADMIN de sistema escolhido pelo servidor. Membership ACTIVE converge sem duplicação; INVITED/REMOVED converge pelo aceite. Usuário ou membro suspenso exige reativação explícita. Nunca concede PLATFORM_OWNER.
- Política V1: um OWNER por tenant, inclusive um único onboarding OWNER pendente. Segundo OWNER, transferência/rebaixamento e suspensão do OWNER são recusados. TENANT_ADMIN comum não implica flag OWNER. A última autoridade TENANT_ADMIN do OWNER não pode ser revogada pelo próprio usuário nem por outro administrador.
- Convites: preview e aceite públicos usam segredo no corpo da requisição. Novo usuário define senha; usuário existente mantém credenciais. Aceite é transacional e serializado, inclusive criação concorrente de identidade por e-mail. Tenant esperado apenas restringe o tenant persistido do convite. Inválido, expirado, revogado, reutilizado, tenant errado, tenant suspenso/cancelado e identidades suspensas são recusados.
- Onboarding em PROVISIONING é permitido; Workspace depende da ativação. Novo link contém token no fragmento, removido da URL ao carregar; não vai para query string, storage ou logs. Respostas sensíveis usam no-store. Se um convite OWNER válido já existe, o token não é recuperado; UI orienta usar o link original ou revogar/reemitir.
- Members: listar, suspender e reativar mantendo histórico. Sem hard delete. Suspensão libera seats; reativação não reassina licenças silenciosamente.
- Seats: contratado, ocupado e disponível vêm do CORE. Atribuição/revogação mantêm a infraestrutura existente. Liberação verifica tenant, membership da rota e seat. Quota 2/overage 0 recusa o terceiro seat no servidor, inclusive concorrência e HTTP direto.
- ON_INVITE: reservas são revalidadas contra entitlement efetivo no aceite. Convite expirado com reserva aparece com `hasReservedSeats`; a ação existente de revoke oferece **Liberar reserva**, finaliza EXPIRED e libera licenças idempotentemente. GET não tem efeitos. Não há scheduler novo; a liberação pode ocorrer por aceite expirado, revogação/encerramento administrativo, reemissão ou manutenção existente.
- Roles: UI usa catálogo existente. Somente roles de sistema tenant ou do próprio tenant são delegáveis, sem permissions de plataforma. Delegação exige autoridade atual e subconjunto dos poderes do ator. Convites com roles/seats/unit scopes exigem também as permissões específicas. Não há role builder.
- Entitlements: plataforma controla Planning, OPS, PALM e Sales. ON/OFF foi validado apenas na camada administrativa. Tenant Owner consulta módulos contratados e não ativa módulos novos. Projeção de contexto reutiliza o helper temporal existente, requer módulo ativo e seat humano ACTIVE; resolver/fachada Planning permanecem intactos.

## APIs

Todas usam prefixo `/core`. Rotas `/admin` exigem PLATFORM_OWNER persistido.

| Método/rota | Finalidade |
| --- | --- |
| PATCH `/admin/tenants/:tenantId` | Editar atributos permitidos |
| POST `/admin/tenants/:tenantId/activate` | Ativar tenant provisionado/em trial |
| POST `/admin/tenants/:tenantId/owner` | Designar OWNER com `{email}` |
| GET `/admin/tenants/:tenantId/roles` | Catálogo de roles tenant |
| GET `/admin/tenants/:tenantId/memberships` | Membros reais e suas roles/seats |
| GET `/admin/tenants/:tenantId/invitations` | Convites sanitizados e estado atual |
| POST `/admin/tenants/:tenantId/invitations/:invitationId/revoke` | Revogar convite ou liberar reserva vencida |
| POST `/invitations/preview` | Consultar `{token, tenantId?}` sem autenticação |
| POST `/invitations/accept` | Aceitar `{token, tenantId?, fullName?, password?}` |

APIs existentes de create/suspend/reactivate, entitlements/quotas, members, seats e grants/revokes permanecem canônicas. A lista de membros resolve roles por ID para incluir definições de sistema cuja relação composta opcional era nula.

## Arquivos e persistência

[implementation-files.json](implementation-files.json) lista os **12 arquivos CORE e 9 Landing** do commit desta fase. CORE: schema/migration, DTO/controllers, ContextService, TenantsService, MembershipsService, InvitationsService, RbacService, contrato técnico e nova suíte HTTP. Landing: core-client, Workspace JS/HTML, cc-live, invitation HTML/JS e três arquivos de testes. CSS existente foi reutilizado.

Migration `20261006000100_tenant_administration_closure`, aplicada primeiro em `routflex_core_test` e depois em `routflex_core`, adiciona:

1. `invitations.intended_tenant_owner BOOLEAN NOT NULL DEFAULT false`;
2. índice parcial único `tenant_memberships_single_owner_key` em tenant_id onde is_tenant_owner=true.

Preflight confirmou zero tenants com OWNER duplicado e hashes idênticos ao baseline. Depois, somente `_prisma_migrations` e a representação das cinco invitations mudaram; removendo a nova coluna, todas as linhas originais de invitations têm o mesmo hash. As outras **20 tabelas** permanecem idênticas, incluindo usuários, sessões de autenticação, grants A/B Snapshot, entitlements, quotas, seats, auditoria e OperationSession. Nenhum seed operacional foi executado. [core-after.json](core-after.json) contém apenas hashes/metadados.

## Auditoria e isolamento

Infraestrutura append-only existente preservada. Novos eventos tenant.updated, tenant.activated, tenant.owner_invited, tenant.owner_assigned e invitation.expired reutilizam a transação da mutação. Eventos existentes cobrem criação/suspensão/reativação, aceite/revogação, roles, seats, entitlements e quotas. Ator, tenant e correlação vêm do contexto confiável. Senhas, cookies, tokens e hashes de credenciais não são gravados na auditoria.

Negativos HTTP cobrem Tenant A contra B: consultar administração/listar membros, alterar membro, atribuir/revogar seat e alterar role. Também OPERATOR sem autoridade, header de autoridade manipulado, JWT emitido antes da suspensão, usuário global desabilitado, membro suspenso, tenant suspenso, entitlement ausente/OFF, quota, role global/de outro tenant e role tenant contaminada com permission de plataforma. Concorrência cobre OWNER, seats e aceite do mesmo convite.

## Validação

| Verificação | Resultado |
| --- | --- |
| Baseline CORE | 239/239, 20 suítes |
| CORE final | 291/291, 21 suítes |
| CORE unitários / integração | 135/135 / 156/156 |
| Nova integração HTTP Tenant Administration | 52/52, incluídos nos 291 |
| Baseline Landing | 14/14 |
| Landing final | 38/38, mesmos 14 anteriores mais 24 novos |
| Planning entry smoke | 25/25, auth-client e tenant-storage |
| CORE typecheck/build | PASS |
| Prisma validate/generate | PASS |
| Sintaxe dos quatro JS Landing afetados | PASS |
| Diff check e secrets scan dos 21 arquivos de implementação | PASS |
| Browser real | 0 executados; indisponível |
| Lint | Não aplicável: nenhum script/configuração de lint executável nestes projetos |

CORE usa PostgreSQL de teste separado (`routflex_core_test`, schema core). Cleanup confirmou zero fixtures novas remanescentes e triggers de auditoria habilitados. Nenhum teste CORE anterior foi alterado; no Landing, os asserts anteriores foram preservados e o helper recebeu apenas suporte ao href. Os testes de UI executam as funções reais com DOM/API controlados; não substituem evidência visual de browser.

Logs completos ficam **localmente** nesta pasta, incluindo baseline, testes finais, tentativas iniciais corrigidas, migrations, build/typecheck e Prisma. [core-test-results.json](core-test-results.json) consolida resultados CORE; [runtime-smoke.json](runtime-smoke.json) registra health/JWKS 200, rotas privadas 401 sem credenciais, preview inválido 404/no-store e páginas existentes/convite 200. Primeiro erro da suíte nova era expectativa 400 em vez de 409; outro revelou retorno PostgreSQL VOID no advisory lock, corrigido para SELECT 1. A última execução integral está verde.

## Proteção Planning e trabalho anterior

**PLANNING FILES CHANGED: 0. PLANNING DATABASE CHANGED: NO.**

[file-preservation-after.json](file-preservation-after.json): 1.552/1.552 arquivos anteriores de ROUTflex e 352/352 de Sales idênticos. Todas as alterações preexistentes de marketing Landing também preservadas. Banco Planning SHA-256 `1cadd6cb7da276544ee6295caa44c52134dbcfbbbaf050f890af738a8aa14d58`; manual_plan_65 `290bdee975e6b7bf53c9677ca42fdd8eca81482888c9f4e387999b21aee487f8`.

Snapshot rollout/test, catálogo de permissões Planning, facade/resolver, OperationSession, Connected READ/WRITE, Route/RouteVersion/History e demais domínios protegidos não foram editados. Auditoria anterior e seus 43 grupos de exportação permanecem intactos. Nenhuma necessidade `PLANNING CHANGE REQUIRED` foi encontrada.

## Git, preservação e backup

Estado anterior, staged/unstaged/untracked, diffs e hashes foram registrados antes da implementação. Índices estavam vazios. Cópias locais verificadas preservam todo o worktree anterior; não houve reset, descarte ou stash. Artefatos privados de preservação, env e logs brutos não entram na publicação.

- Pré-requisitos CORE preexistentes: `b6cdca7`, checkpoint separado.
- Snapshot isolado: `4902790a7a0e0c7698c2b44aeb6c828df5cfa8fb`, somente rollout e teste exclusivos. Não aprova LIVE A/B.
- CORE Tenant Administration: `90323c73d3e398131d22760d703d4aceaf470647`.
- Baseline administrativo Landing: `e15fe02307aedc956b33e89da87a1b84e1cda8e3`.
- Landing Tenant Administration: `fffd4a522ee3bf9e715196f4c862f538c5558443`, branch `feat/tenant-administration-closure-v1`.
- Documentação usa worktree/branch `docs/tenant-administration-closure-v1` baseado no remoto `36984e9455412bead56ab993e5cdf9d93bf210ed`; não publica os dois commits Planning locais anteriores. Branch e alterações do worktree Planning original permanecem intactas.

**CORE remote: NOT CONFIGURED. REMOTE BACKUP: PENDING. GITHUB BACKUP: BLOCKED — REMOTE NOT CONFIGURED.** Inspeção de `.git/config`, remotes/upstream, configuração/documentos locais e remotes irmãos não identificou URL CORE. GitHub CLI não estava instalado; a consulta conectada ao owner conhecido não forneceu destino. Nenhuma URL foi inventada ou repositório criado.

Bundles completos verificados em `C:\ROUTflex\.tmp\tenant-admin-closure-20261006`: `core-snapshot-checkpoint.bundle`, `landing-admin-baseline.bundle`, `core-tenant-admin-final.bundle`, `landing-tenant-admin-final.bundle`. São backups **locais**, não externos. Estado de push/HEAD está no manifesto final local e em [landing-push.json](landing-push.json).

## Limites e rollback

Limites explícitos: um OWNER, sem transferência nesta V1; entrega manual do link; sem billing; sem scheduler adicional de expiração; sem validação visual nesta sessão. Export Governance e enforcement interno OPS/PALM/Sales são backlog separado. Snapshot LIVE A/B permanece pendente exclusivamente da disponibilidade de navegador controlável.

Rollback deve ser um novo commit/release reversível, preservando dados e histórico. CORE pode retornar ao checkpoint Snapshot e Landing ao baseline administrativo, revertendo os commits desta fase. Parar escritas administrativas e revogar convites OWNER pendentes antes de retornar ao código antigo, que não interpreta owner intent. Manter a coluna e o índice aditivos é compatível com o código anterior; não apagar memberships, seats ou audit logs para rollback. Não executar rollback no Planning. A migration aplicada não deve ser reescrita.

Próxima fase coesa: **aceite operacional desta entrega** — determinar o remote legítimo CORE, publicar e conferir seu HEAD, e executar o roteiro Super Admin → OWNER → segundo usuário → terceiro seat bloqueado quando houver navegador. Snapshot LIVE A/B mantém seu roteiro e aprovação próprios.
