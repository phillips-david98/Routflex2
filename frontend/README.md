# routflex
Sistema de roteirização logística inteligente com foco em otimização de rotas, agrupamento por DDD e análise operacional.

## Botão Dashboard CRM

O módulo principal (`map.html`) possui o botão `Dashboard CRM`, que abre o CRM em nova aba com o contexto da sessão atual.

Parâmetros enviados automaticamente na URL:

- `session_id`
- `regiao`
- `data` (formato `YYYY-MM-DD`)
- `rota_id` (quando houver rota selecionada)

Prioridade de configuração da URL do CRM:

1. Query param `crm_url` na própria URL do `map.html`
2. `window.ROUTFLEX_RUNTIME_CONFIG.crmDashboardUrl`
3. `window.ROUTFLEX_RUNTIME_CONFIG.crmUrl`
4. `window.__ROUTFLEX_CRM_URL__`
5. Fallback automático para `http://localhost:5173/`

No código, a variável de configuração principal é:

```js
const CRM_URL = 'http://localhost:5173/';
```

Antes de abrir a nova aba, o sistema valida se o CRM está acessível. Se não estiver, exibe um alerta amigável orientando a iniciar o serviço.

Exemplo de configuração via script global antes do `map.html`:

```html
<script>
	window.ROUTFLEX_RUNTIME_CONFIG = {
		crmDashboardUrl: 'http://localhost:5173/'
	};
</script>
```

Exemplo de override rápido via URL:

```text
map.html?crm_url=http://localhost:5173/
```
