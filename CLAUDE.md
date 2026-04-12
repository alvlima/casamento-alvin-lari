# casamento-alvin-lari — Guia para Claude Code

Site de convite de casamento de Larissa & Alvaro (01/08/2026).
Stack: **Vite + React 19 + TypeScript + Tailwind CSS v4 + Framer Motion + Lucide React**.

---

## Estrutura do Projeto

```
src/
  App.tsx                    # Orquestrador: estado global (currentRoom, inventory, shows, admin)
  main.tsx                   # Entry point — StrictMode + createRoot
  index.css                  # @import "tailwindcss" + resets + utilities globais
  constants/
    theme.ts                 # Paleta de cores AP Patinhas, tipos RoomId / InventoryKey
  types/
    admin.ts                 # Interfaces TypeScript do domínio admin
  services/
    adminData.ts             # Mock data + pontos de integração com backend MySQL
  components/
    NavHUD.tsx               # Barra de progresso fixa no topo
    IntroScreen.tsx          # Tela inicial animada (inclui acesso oculto ao admin)
    RoomView.tsx             # Lógica dos cômodos + SalaInteractive / EscritorioInteractive / VarandaContent
    RSVPOverlay.tsx          # Modal de confirmação de presença (lazy)
    GiftList.tsx             # Lista de presentes com modal Pix (lazy)
    AdminLogin.tsx           # Gate de senha do painel admin (lazy)
    AdminPanel.tsx           # Painel admin completo — 3 abas (lazy)
```

---

## Regras de Performance — Frontend

1. **Dados estáticos fora de componentes** — `ROOMS`, `colors`, `KEY_ICONS`, `GIFTS` são constantes de módulo. Nunca mova-os para dentro de funções ou componentes.

2. **`React.memo` em tudo que não muda frequentemente** — todos os componentes filhos são memoizados. Mantenha esse padrão ao criar novos.

3. **`useCallback` para handlers** — handlers passados como props devem sempre ser wrapped em `useCallback` no `App.tsx`.

4. **`useMemo` para cálculos derivados** — listas filtradas, totais e agrupamentos no `AdminPanel` usam `useMemo`. Não recalcule na renderização.

5. **Lazy loading de todos os overlays** — `RSVPOverlay`, `GiftList`, `AdminLogin` e `AdminPanel` são carregados via `React.lazy` + `Suspense`. Mantenha esse padrão para qualquer modal ou overlay futuro.

6. **Code splitting de vendor** — `vite.config.ts` usa `manualChunks` para separar `framer-motion` e `lucide-react`. Não remova.

7. **Props granulares** — `VarandaContent` recebe `allKeysCollected: boolean`, não o array `inventory` inteiro. Minimize o escopo de cada prop.

8. **Carregamento paralelo no admin** — `AdminPanel` dispara `Promise.all([...4 queries...])` no `useEffect`. Nunca carregue os dados em série.

---

## Schema MySQL — Banco `alvar028_casamentos`

> Arquitetura **multi-tenant por linha** — todos os casais compartilham as mesmas tabelas.
> O isolamento é garantido pela coluna `couple_id` presente em todas as tabelas de dados.
> Script completo para importar no HostGator: `database/schema.sql`
> Motor: **InnoDB** · Charset: **utf8mb4_unicode_ci**

### Modelo de dados

```
couples  (tenant raiz)
   │
   ├── admin_sessions   (autenticação por token, expira em 8h)
   ├── rsvp_responses   (confirmações de presença)
   ├── gift_items       (lista de presentes configurável por casal)
   └── gift_contributions (contribuições, vinculadas ou livres)
```

### Tabela `couples` (tenant)

```sql
CREATE TABLE couples (
  id               CHAR(36)     PK,
  slug             VARCHAR(100) UNIQUE,     -- 'alvin-lari' → URL do painel
  name_partner_1   VARCHAR(255),
  name_partner_2   VARCHAR(255),
  wedding_date     DATE,
  wedding_location VARCHAR(255),
  pix_key          VARCHAR(255),
  password_hash    VARCHAR(255),            -- bcrypt custo 12
  active           TINYINT(1)   DEFAULT 1
)
```

### Tabela `rsvp_responses`

```sql
-- Índices: (couple_id, attendance) + (couple_id, created_at DESC)
-- TODA query deve ter WHERE couple_id = ?
```

### Tabela `gift_contributions`

```sql
-- gift_item_id nullable: aceita contribuição livre sem vínculo a item
-- Índice composto (couple_id, gift_item_id) cobre GROUP BY + SUM sem filesort
```

### Views pré-computadas

| View | Uso |
|---|---|
| `v_rsvp_summary` | Total/confirmados/declinados por casal |
| `v_gift_summary` | Total arrecadado por item, por casal |
| `v_couple_dashboard` | KPIs consolidados (JOIN de todas as views) |

### Como adicionar um novo casal

```bash
# POST /api/couples  (requer X-Master-Key no header)
{
  "slug": "joao-maria",
  "name_partner_1": "João",
  "name_partner_2": "Maria",
  "wedding_date": "2027-03-15",
  "password": "senha_do_casal"
}
```

---

## Isolamento de Tenant — Regras Críticas

1. **`couple_id` vem do token, nunca do request.** O frontend envia apenas o Bearer token. O backend PHP resolve o `couple_id` via `admin_sessions.token` — nunca aceite `couple_id` no body/query de rotas autenticadas.

2. **Toda query autenticada filtra por `couple_id`.** Sem exceção. Ver `get_authenticated_couple_id()` em `database/api_reference.php`.

3. **Rotas públicas (RSVP/gifts do convidado) usam o `slug` na query string** (`?couple=alvin-lari`) — o backend resolve o `couple_id` internamente.

4. **`ON DELETE CASCADE`** em todas as FK para `couples.id` — deletar um casal limpa todos os seus dados automaticamente.

---

## Diretrizes de Performance — MySQL

### Índices

- **Nunca filtre sem índice.** Toda coluna usada em `WHERE`, `ORDER BY` ou `GROUP BY` deve ter um índice correspondente.
- **Índices compostos seguem a ordem das queries.** O índice `(gift_id, amount)` cobre `WHERE gift_id = ? ORDER BY amount` mas **não** o inverso.
- **Não crie índices em colunas de alta cardinalidade sem seletividade real.** `message TEXT` e `contributor` não precisam de índice — nunca são filtrados.
- **`CHAR(36)` para UUIDs** — tamanho fixo é mais eficiente que `VARCHAR(36)` para chaves primárias em InnoDB.

### Queries

- **Use `LIMIT` em toda listagem.** O painel admin deve paginar: `LIMIT 50 OFFSET ?`.
- **Prefira `COUNT(*)` a `COUNT(id)`** — o MySQL otimiza `COUNT(*)` usando o índice de menor custo.
- **Nunca use `SELECT *` em produção.** Liste as colunas explicitamente para evitar transferir dados desnecessários.
- **Transações para writes múltiplos.** Se no futuro um RSVP criar mais de um registro, envolva em `BEGIN / COMMIT`.

### Recursividade / CTEs

Se a estrutura de dados evoluir para hierarquias (ex: grupos de convidados com sub-convidados):

```sql
-- Exemplo de CTE recursiva para árvore de convidados
WITH RECURSIVE guest_tree AS (
  -- Âncora: convidados raiz
  SELECT id, name, parent_id, 0 AS depth
  FROM guests
  WHERE parent_id IS NULL

  UNION ALL

  -- Passo recursivo
  SELECT g.id, g.name, g.parent_id, gt.depth + 1
  FROM guests g
  INNER JOIN guest_tree gt ON g.parent_id = gt.id
  WHERE gt.depth < 5  -- guard contra loops infinitos
)
SELECT * FROM guest_tree ORDER BY depth, name;
```

**Regras para CTEs recursivas:**
1. Sempre defina `WHERE depth < N` como guard de profundidade.
2. Use `UNION ALL` (não `UNION`) — duplicatas não existem em árvores e `UNION ALL` não faz dedup.
3. Monitore `@@cte_max_recursion_depth` (padrão 1000) — ajuste se necessário.

### Segurança

- **Nunca exponha credenciais MySQL no frontend.** O painel admin consome uma API REST/backend — o banco nunca é acessado diretamente pelo React.
- **Senha do painel em `AdminLogin.tsx` é client-side** — suficiente para uso pessoal. Para produção, mova a validação para o backend com JWT.
- **Sanitize inputs** no backend antes de qualquer `INSERT` — use prepared statements (ex: `mysql2` com `?` placeholders no Node.js).

---

## Paleta de Cores (AP Patinhas)

| Token           | Hex       | Uso                          |
|----------------|-----------|------------------------------|
| `damasco`       | `#E8C9B5` | Sala de estar (bg do cômodo) |
| `sonhoAnjo`     | `#F2F1EC` | Background geral da página   |
| `carvalhoDian`  | `#D6BC9D` | Borda do botão de afeto      |
| `azulAstral`    | `#8FA9B8` | Escritório (bg do cômodo)    |
| `tomilhoSeco`   | `#94A684` | Varanda, acentos verdes      |

---

## Fluxo do Jogo

```
IntroScreen → entrada → sala (coletar Afeto) → escritório (coletar Intuição + Lógica) → varanda
```

Na varanda, se `inventory.length < 3` → mostra tela de acesso restrito.
Se `inventory.length === 3` → mostra card com data/local + botões RSVP e Lista de Presentes.

## Rotas

| Rota | Componente | Descrição |
|---|---|---|
| `/` | `MainSite` | Site público do casamento |
| `/login` | `AdminLoginPage` | Login dos noivos |
| `/admin` | `AdminPanelPage` | Painel protegido (guard: `sessionStorage`) |

Senha padrão: `alvinelari2026` — definida em `AdminLoginPage.tsx:ADMIN_PASSWORD`.
Auth guard: `sessionStorage.getItem('admin_auth') === 'true'` — redireciona para `/login` se ausente.
Deploy estático: `public/_redirects` (`/* /index.html 200`) garante SPA em Netlify/Vercel.

---

## Comandos

```bash
# Desenvolvimento
npm_config_registry=https://registry.npmjs.org npm run dev

# Build de produção
npm_config_registry=https://registry.npmjs.org npm run build

# Instalar dependências
npm_config_registry=https://registry.npmjs.org npm install
```

> **Importante:** o `.npmrc` do sistema aponta para o registry do Fury (Mercado Livre).
> Use sempre `npm_config_registry=https://registry.npmjs.org` para instalar pacotes neste projeto.

---

## Convenções de Código

- Arquivos de componentes: PascalCase (`RoomView.tsx`)
- Constantes de módulo: SCREAMING_SNAKE_CASE (`ROOMS`, `KEY_ICONS`, `GIFTS`)
- Tipos exportados em `types/admin.ts` e `constants/theme.ts`, nunca inline
- Não usar `default export` nos componentes — usar `export const` + `displayName`
- Tailwind classes inline; sem arquivos `.module.css`
