# Multi-account provider plan

## Doel

Manifest moet providers niet langer behandelen als maximaal `1 x api_key` en `1 x subscription` per agent.

Doel van dit plan:

- elke provider generiek kunnen koppelen met **2e, 3e, 4e, ... account**
- dit laten werken voor **API key** én **subscription** auth
- routing, tier overrides, specificity overrides en fallbacks naar het **juiste account** laten wijzen
- nieuwe providers, zoals **Nano-GPT**, direct op dit model kunnen aansluiten

---

## Providers in scope

### Bestaan nu al met subscription support

1. `anthropic`
2. `openai`
3. `minimax`
4. `ollama-cloud`
5. `zai`
6. `opencode-go`
7. `copilot`

Bron: `packages/shared/src/subscription/configs.ts`

### Extra meenemen

8. **Nano-GPT**

Nano-GPT zit **nog niet op `main`**, maar is wél al toegevoegd in open PR:

- PR `#1652` — `feat(providers): add NanoGPT built-in provider`
- URL: `https://github.com/mnfst/manifest/pull/1652`

Wat die PR toevoegt:

- entry in `packages/shared/src/providers.ts`
- model-prefix inference in `packages/shared/src/provider-inference.ts`
- backend model discovery in `packages/backend/src/model-discovery/provider-model-fetcher.service.ts`
- backend proxy endpoint in `packages/backend/src/routing/proxy/provider-endpoints.ts`
- frontend provider UI entry in `packages/frontend/src/services/providers.ts`
- frontend API-key URL in `packages/frontend/src/services/provider-api-key-urls.ts`
- frontend icon in `packages/frontend/public/icons/providers/nano-gpt.svg`

Wat die PR **niet** toevoegt:

- geen entry in `packages/shared/src/subscription/configs.ts`
- dus **geen subscription flow**, alleen built-in **API-key provider**

Gevolg voor dit plan:

- het multi-account ontwerp moet Nano-GPT behandelen als een provider die **elk moment op `main` kan landen**
- zodra PR `#1652` merge't, moet Nano-GPT **zonder extra provider-specifieke refactor** meteen meerdere API-key accounts kunnen krijgen
- als Nano-GPT later ook subscription support krijgt, moet dat op exact hetzelfde generieke account-model landen

---

## Huidige blokkades

### 1. Database blokkeert meerdere accounts per provider/auth type

`packages/backend/src/entities/user-provider.entity.ts`

```ts
@Index(['agent_id', 'provider', 'auth_type'], { unique: true })
```

Daardoor kan een agent nu maar hebben:

- 1 `openai + api_key`
- 1 `openai + subscription`
- 1 `copilot + subscription`
- etc.

De bijbehorende migratie staat in:

- `packages/backend/src/database/migrations/1773000000000-ExpandProviderUniqueKey.ts`

### 2. Backend schrijft altijd naar één record

`packages/backend/src/routing/routing-core/provider.service.ts`

- `upsertProvider()` zoekt op `(agent_id, provider, auth_type)`
- `registerSubscriptionProvider()` zoekt op `(agent_id, provider, 'subscription')`

Gevolg: een 2e account zou het eerste overschrijven of wordt niet aangemaakt.

### 3. Routing kan niet naar een specifiek account wijzen

`packages/backend/src/routing/routing-core/provider-key.service.ts`

- `getAuthType()` kiest één match
- `resolveProviderApiKey()` kiest één record

Er is geen concept van:

- “OpenAI work account”
- “OpenAI personal account”
- “Copilot account 2”

### 4. Overrides zijn te grof

`packages/backend/src/entities/tier-assignment.entity.ts`

- `override_provider`
- `override_auth_type`

`packages/backend/src/entities/specificity-assignment.entity.ts`

- `override_provider`
- `override_auth_type`

Dat is niet genoeg als je meerdere accounts van dezelfde provider/auth type hebt.

### 5. Frontend gaat uit van één connectie per provider/auth type

Belangrijkste plekken:

- `packages/frontend/src/services/api/routing.ts`
- `packages/frontend/src/components/ProviderSelectContent.tsx`
- `packages/frontend/src/components/ProviderSubscriptionTab.tsx`

De UI denkt nu in:

- “OpenAI connected / not connected”
- “Copilot connected / not connected”

en niet in:

- “OpenAI has 3 accounts”
- “Copilot has 2 subscriptions”

### 6. Cache, resolve en proxy zijn nog niet account-aware

Extra plekken waar single-account impliciet ingebakken zit:

- `packages/backend/src/routing/routing-core/routing-cache.service.ts`
  - cache keys zijn nu provider/auth-type-gebaseerd, niet account-gebaseerd
- `packages/backend/src/routing/dto/resolve-response.ts`
  - `fallback_models` is nu alleen `string[]`
- `packages/backend/src/routing/proxy/proxy.service.ts`
  - proxy krijgt nu geen exact provider-account terug uit resolve
- `packages/backend/src/routing/proxy/proxy-fallback.service.ts`
  - fallback-resolutie werkt nu string-first en niet account-first

Gevolg: zelfs als database en services meerdere accounts toestaan, kan runtime alsnog het verkeerde account cachen of forwarden.

### 7. Subscription registratie heeft nog extra single-account aannames

Extra backend-paden die nu nog uitgaan van één slot per provider/auth type:

- `packages/backend/src/routing/resolve/resolve.controller.ts`
  - `POST /subscription-providers` schrijft nog via de bestaande single-account flows
- `packages/backend/src/routing/routing-core/provider.service.ts`
  - `registerSubscriptionProvider()` heeft extra guard-gedrag rond bestaande API-key records

Gevolg: vooral subscription providers kunnen nog stil op het verkeerde record landen of een 2e account blokkeren.

### 8. OAuth/device-code flows missen account-context in hun state

Belangrijke plekken:

- `packages/backend/src/routing/oauth/openai-oauth.controller.ts`
- `packages/backend/src/routing/oauth/openai-oauth.service.ts`
- `packages/backend/src/routing/oauth/minimax-oauth.controller.ts`
- `packages/backend/src/routing/oauth/minimax-oauth.service.ts`
- `packages/backend/src/routing/oauth/copilot-device-auth.service.ts`

Gevolg: zodra twee account-flows parallel lopen voor dezelfde provider, moet de flow-state exact weten welk provider-account-record gevuld of bijgewerkt wordt.

### 9. Model discovery en invalidation leunen ook nog op provider-niveau

Extra scope die mee moet in de refactor:

- `packages/backend/src/model-discovery/model-discovery.service.ts`
- `packages/backend/src/model-discovery/provider-model-registry.service.ts`
- `packages/backend/src/routing/routing-core/routing-invalidation.service.ts`
- `packages/backend/src/routing/routing-core/tier-auto-assign.service.ts`

Gevolg: cached models, auto-assign en cleanup moeten exact weten bij welk account een model hoort.

### 10. Test-impact is groter dan alleen routing UI en core services

Deze refactor raakt ook:

- backend unit tests voor provider/tier/specificity/proxy/oauth/model discovery
- backend e2e tests voor routing/proxy/custom providers
- frontend API- en provider-picker tests

Omdat het huidige gedrag impliciet single-account is, moet testdekking vanaf dag 1 account-aware meebewegen.

---

## Ontwerpkeuze

### Kernbesluit

Maak van `user_providers` expliciet een **provider account** record.

Dus niet meer:

- provider = OpenAI
- auth_type = subscription
- klaar

Maar:

- provider = OpenAI
- auth_type = subscription
- account = `personal`

en daarnaast:

- provider = OpenAI
- auth_type = subscription
- account = `work`

Het systeem moet generiek werken voor **N accounts**, niet alleen voor “een 2e account”.

---

## Gewenst eindmodel

## 1. `user_providers` wordt de account-laag

Huidige tabel hergebruiken, maar uitbreiden.

### Nieuwe velden

- `account_label: varchar`
  - menselijk label, bv. `default`, `work`, `personal`, `team-2`
  - **alleen display/UI**, nooit routing-key
- `is_default: boolean`
  - default account binnen `(agent_id, provider, auth_type)`

### Blijft bestaand

- `id`
- `agent_id`
- `provider`
- `auth_type`
- `api_key_encrypted`
- `cached_models`
- `region`
- `is_active`

### Nieuwe unieke index

Vervang:

- `(agent_id, provider, auth_type)`

door:

- `(agent_id, provider, auth_type, account_label)`

Aanbevolen als **partial unique index** op alleen actieve records:

- `(agent_id, provider, auth_type, account_label) WHERE is_active = true`

en daarnaast nog een tweede invariant:

- maximaal één default per `(agent_id, provider, auth_type)`
- dus een partial unique index op `(agent_id, provider, auth_type) WHERE is_default = true AND is_active = true`

### Defaults / invariants

- `account_label` krijgt database-default `'default'`
- `is_default` krijgt database-default `false`
- bestaande rows worden gebackfilld naar:
  - `account_label = 'default'`
  - `is_default = true`
- nieuwe non-default accounts worden expliciet door de service-layer aangemaakt

### Belangrijk ontwerpprincipe

Gebruik:

- `user_providers.id` voor **alle machine references**
- `account_label` alleen voor display, forms en human-readable keuze in de UI

Dus:

- overrides verwijzen naar `user_providers.id`
- fallback-targets verwijzen naar `user_providers.id`
- cache keys gebruiken `user_providers.id`
- proxy/key resolution resolve't uiteindelijk naar `user_providers.id`

### Delete-keuze

De bestaande code gebruikt al `is_active` als soft-disconnect. Dat is waarschijnlijk de minst risicovolle route om te houden.

Dan moet de index-strategie daar wel expliciet op ingericht zijn:

- unieke account labels alleen afdwingen op actieve records
- default alleen afdwingen op actieve records
- reconnect met dezelfde label moet mogelijk blijven nadat een oud record inactive is gemaakt

### Waarom zo?

- meerdere accounts worden mogelijk
- labels blijven leesbaar in UI en API
- `is_default` geeft een veilige standaardkeuze
- bestaande records kunnen zonder functionele breuk naar `account_label='default'`

---

## 2. Routing moet naar een specifiek account kunnen wijzen

De belangrijkste verbetering is: routing mag niet meer alleen provider + auth type kennen.

Hij moet kunnen kiezen tussen bijvoorbeeld:

- `openai / subscription / default`
- `openai / subscription / work`
- `openai / api_key / team`

### Aanbevolen resolutievolgorde

1. **Exact override-account** als die is ingesteld
2. Anders: **default account** voor die provider/auth type
3. Anders: provider-brede fallback volgens bestaande logica
4. Anders: geen bruikbare credential

### Praktische implementatie

De resolve-laag moet niet alleen een provider-string teruggeven, maar ook het exacte account-record.

Concreet:

- resolve geeft `userProviderId` terug naast provider/model metadata
- proxy forwarding gebruikt daarna een exacte lookup op `userProviderId`
- key resolution krijgt dus een nieuw pad als:
  - `getProviderApiKeyById(userProviderId)`

Hiermee voorkom je dat latere helperlogica opnieuw “de beste OpenAI account” probeert te raden.

### Belangrijk principe

De selector moet altijd account-aware zijn op de plekken waar routing definitief wordt:

- tier routing
- specificity routing
- fallback routing
- proxy forwarding

---

## 3. Overrides moeten account-aware worden

### Tier assignments

`packages/backend/src/entities/tier-assignment.entity.ts`

Voeg toe:

- `override_provider_id: string | null`

en laat deze verwijzen naar `user_providers.id`.

`override_provider` en `override_auth_type` mogen alleen heel kort als migratiebrug blijven bestaan. Laat `override_provider_id` zo snel mogelijk de enige source of truth worden.

### Specificity assignments

`packages/backend/src/entities/specificity-assignment.entity.ts`

Voeg toe:

- `override_provider_id: string | null`

### Waarom ID en niet alleen label?

Voor routing is een intern stabiele sleutel beter dan een display label.

Gebruik daarom:

- `id` voor machine references
- `account_label` voor UI

### Gedrag bij verwijderen account

Als een account waar een override naar wijst wordt verwijderd:

- override moet graceful terugvallen naar auto/default
- UI moet waarschuwing tonen
- backend moet dit niet hard laten crashen

Aanvulling:

- als er echte deletes blijven bestaan, zet `override_provider_id` als nullable FK met `ON DELETE SET NULL`
- bij soft-disconnect (`is_active = false`) moet de runtime de override negeren en terugvallen naar auto/default
- orphan-cleanup/invalidation moet dus ook op `override_provider_id` werken, niet alleen op provider-string

---

## 3b. Backfill plan voor legacy override-kolommen

De bestaande kolommen `override_provider` en `override_auth_type` op `tier_assignments` en `specificity_assignments` bevatten waarden uit de pre-multi-account periode. Zodra `override_provider_id` beschikbaar is, moeten deze legacy waarden gemigreerd worden zodat bestaande overrides niet breken.

### Migratiestappen

1. **Identificeer rows met een override maar zonder `override_provider_id`**
   - `SELECT` alle `tier_assignments` en `specificity_assignments` waar `override_provider IS NOT NULL AND override_provider_id IS NULL`
2. **Resolve `override_provider_id` per row**
   - Voor elke row: zoek het actieve `user_providers` record dat matcht op `(agent_id, provider, auth_type)` met `is_default = true` of — als er maar één is — dat record
   - Als er geen match is (provider verwijderd): laat `override_provider_id` als `NULL` en log een waarschuwing
3. **Schrijf een migratie-script**
   ```sql
   UPDATE tier_assignments t
   SET override_provider_id = (
     SELECT up.id FROM user_providers up
     WHERE up.agent_id = t.agent_id
       AND up.provider = t.override_provider
       AND (up.auth_type = t.override_auth_type OR t.override_auth_type IS NULL)
       AND up.is_active = true
     ORDER BY up.is_default DESC
     LIMIT 1
   )
   WHERE t.override_provider IS NOT NULL
     AND t.override_provider_id IS NULL;
   ```
   Herhaal voor `specificity_assignments`.
4. **Validatie na migratie**
   - Verifieer dat geen enkele actieve override meer een `override_provider` heeft zonder bijbehorend `override_provider_id`
   - Spot-check: compareer counts before/after
5. **Runtime-gedrag tijdens overgang**
   - `resolve.service` gebruikt `override_provider_id` wanneer aanwezig; valt terug op `override_provider` + `override_auth_type` wanneer `override_provider_id NULL` is
   - Dit garandeert backwards-compatibiliteit tijdens de migratieperiode
6. **Opruiming (volgende release)**
   - Zodra de backfill bevestigd is, kunnen `override_provider` en `override_auth_type` kolommen uit de entity-definitie verwijderd worden en een volgende migratie de kolommen droppen

### Edge cases

- **Meerdere actieve accounts met dezelfde provider+auth_type**: backfill kiest de `is_default = true` account
- **Geen actief account**: `override_provider_id` blijft `NULL`; resolve.service fallthrough naar auto-assigned
- **Custom providers**: `override_provider` bevat `custom:uuid`; backfill moet exacte string-match gebruiken

---

## 4. Fallbacks moeten ook account-aware worden

Huidig model:

- `fallback_models: string[]`

Dat is straks onvoldoende, want dit is ambigu:

- hetzelfde model via 2 OpenAI accounts
- hetzelfde Copilot model via 2 subscriptions

### Nieuwe richting

Fallbacks moeten niet alleen modelnaam opslaan, maar een target-object.

Bijvoorbeeld:

```ts
type FallbackTarget = {
  userProviderId: string;
  model: string;
};
```

Dus niet alleen `gpt-5.4`, maar:

- welk account
- welk provider-record
- welk model

Dit voorkomt ambiguïteit en maakt latere uitbreidingen makkelijker.

Extra voordeel: cleanup wordt simpeler.

In plaats van provider-string matching kan de backend gewoon alles filteren op:

- `fallback.userProviderId !== verwijderdProviderId`

### Migratieregel

Migreer `fallback_models` in één keer per row naar het nieuwe formaat.

Dus:

- óf volledig oud formaat
- óf volledig nieuw formaat

maar geen gemengde JSON-shapes binnen dezelfde deployment-periode.

---

## 5. API moet van “upsert provider” naar “beheer provider accounts”

### Gewenst API-model

#### Lijst alle accounts

`GET /api/v1/routing/:agent/providers`

Response per record:

- `id`
- `provider`
- `auth_type`
- `account_label`
- `is_default`
- `is_active`
- `has_api_key`
- `key_prefix`
- `region`
- `connected_at`

#### Maak nieuw account aan

`POST /api/v1/routing/:agent/providers`

Body:

```json
{
  "provider": "openai",
  "authType": "subscription",
  "accountLabel": "work",
  "apiKey": "..."
}
```

#### Update bestaand account

`PATCH /api/v1/routing/:agent/providers/:providerId`

Voor:

- label wijzigen
- key vervangen
- region wijzigen
- active/inactive toggelen
- `is_default` zetten

#### Verwijder / disconnect specifiek account

`DELETE /api/v1/routing/:agent/providers/:providerId`

Niet meer op alleen `provider + authType`.

Een dedicated `set-default` endpoint kan nog steeds prima, maar is niet per se nodig als `PATCH` dit veilig transactioneel kan doen.

### Backward-compatible overgang

Tijdens migratie mag de API nog tijdelijk accepteren:

- geen `accountLabel`

Dan wordt automatisch gebruikt:

- `accountLabel = 'default'`

### Belangrijke backend-files die hier ook onder vallen

- `packages/backend/src/routing/provider.controller.ts`
- `packages/backend/src/routing/dto/routing.dto.ts`
- `packages/backend/src/routing/dto/specificity.dto.ts`
- `packages/backend/src/routing/resolve/resolve.controller.ts`

---

## 6. OAuth en device-code flows moeten ook account-aware worden

Dit raakt vooral:

- `openai` (popup OAuth)
- `copilot` (device code)
- `minimax` (device code)

### Nieuwe eis

Bij het starten van zo’n flow moet bekend zijn **voor welk account** de flow is.

Bijvoorbeeld:

- “Add OpenAI subscription account: `work`”
- “Add Copilot subscription account: `personal`”

### Praktisch

De start-endpoints moeten `accountLabel` meenemen of een tijdelijke auth-session opslaan die daar naar verwijst.

Bij succesvolle completion moet niet meer naar de enige `provider + auth_type` slot geschreven worden, maar naar het beoogde provider-account record.

Belangrijker nog: de flow-state moet uiteindelijk resolve'n naar een exacte account-reference.

Bij voorkeur:

- bestaande account updaten via `userProviderId`
- nieuw account aanmaken via een tijdelijke state met `accountLabel` + provider/authType

Zonder die expliciete state kan een parallelle OAuth/device-flow voor dezelfde provider op het verkeerde record eindigen.

---

## 7. Frontend moet accounts tonen, niet alleen providers

### Gewenste UI-structuur

Per provider:

- lijst van API-key accounts
- lijst van subscription accounts
- per account: label, status, default badge, disconnect/edit acties
- duidelijke CTA:
  - `Add API account`
  - `Add subscription account`

### Voorbeeld

OpenAI:

- API Keys
  - `default`
  - `team`
- Subscriptions
  - `personal`
  - `work`

Copilot:

- Subscriptions
  - `default`
  - `work`

### Overrides UI

Als een provider maar één account heeft, kan de UI simpel blijven.

Als een provider meerdere accounts heeft, moet de gebruiker ook een account kunnen kiezen in:

- tier override
- specificity override
- fallback editor

Dus:

1. provider kiezen
2. account kiezen
3. model kiezen

---

## Gewenste implementatie per laag

## Fase 1 — database en entities

### Bestanden

- `packages/backend/src/entities/user-provider.entity.ts`
- `packages/backend/src/database/migrations/*`
- `packages/backend/src/entities/tier-assignment.entity.ts`
- `packages/backend/src/entities/specificity-assignment.entity.ts`

### Werk

1. `user_providers` uitbreiden met:
   - `account_label`
   - `is_default`
2. unieke index vervangen
3. bestaande rows backfillen naar:
   - `account_label = 'default'`
   - `is_default = true`
4. tier/specificity assignments uitbreiden met:
   - `override_provider_id`
5. partial unique indexes toevoegen voor:
   - actieve labels
   - actieve defaults
6. database-defaults toevoegen voor:
   - `account_label`
   - `is_default`

### Resultaat

Data model ondersteunt meerdere accounts zonder direct frontend/back-end gedrag al om te gooien.

---

## Fase 2 — provider service en key resolution

### Bestanden

- `packages/backend/src/routing/routing-core/provider.service.ts`
- `packages/backend/src/routing/routing-core/provider-key.service.ts`
- `packages/backend/src/routing/routing-core/routing-cache.service.ts`
- `packages/backend/src/routing/resolve/resolve.service.ts`
- `packages/backend/src/routing/proxy/proxy.service.ts`
- `packages/backend/src/routing/proxy/proxy-fallback.service.ts`
- `packages/backend/src/routing/dto/resolve-response.ts`
- `packages/backend/src/routing/resolve/resolve.controller.ts`
- `packages/backend/src/model-discovery/model-discovery.service.ts`
- `packages/backend/src/routing/routing-core/routing-invalidation.service.ts`

### Werk

1. `upsertProvider()` vervangen door expliciete create/update-account logica
2. `registerSubscriptionProvider()` account-aware maken
3. key resolution account-aware maken
4. cache keys baseren op `userProviderId`
5. resolve flow exact account laten teruggeven
6. proxy/key lookup laten werken op `userProviderId`
7. bestaande subscription guards herzien die nu nog impliciet single-account blokkeren

### Resultaat

Backend kan daadwerkelijk met meerdere accounts werken.

---

## Fase 3 — routing overrides en fallbacks

### Bestanden

- tier/specificity controllers + DTOs
- fallback endpoints/services
- frontend routing API types
- `packages/backend/src/routing/routing-core/tier.service.ts`
- `packages/backend/src/routing/routing-core/specificity.service.ts`
- `packages/backend/src/routing/dto/routing.dto.ts`
- `packages/backend/src/routing/dto/specificity.dto.ts`

### Werk

1. overrides laten verwijzen naar `override_provider_id`
2. fallback-models omzetten naar structured fallback targets
3. validation toevoegen voor verwijzingen naar inactive/deleted accounts
4. oude `override_provider` / `override_auth_type` alleen kort als migratiebrug laten bestaan en daarna verwijderen

### Resultaat

Routing kiest niet alleen de juiste provider, maar ook het juiste account.

---

## Fase 4 — frontend account management UI

### Bestanden

- `packages/frontend/src/services/api/routing.ts`
- `packages/frontend/src/components/ProviderSelectContent.tsx`
- `packages/frontend/src/components/ProviderSubscriptionTab.tsx`
- `packages/frontend/src/components/ProviderDetailView.tsx`
- `packages/frontend/src/components/ProviderApiKeyTab.tsx`
- `packages/frontend/src/components/ProviderKeyForm.tsx`
- `packages/frontend/src/pages/Routing.tsx`
- eventuele provider detail / picker componenten

### Werk

1. `RoutingProvider` uitbreiden met:
   - `account_label`
   - `is_default`
2. provider-overzicht ombouwen naar account-lijsten
3. add/edit/delete/default flows toevoegen
4. override pickers account-aware maken

### Resultaat

UI ondersteunt meerdere accounts zonder verwarrende provider-special-cases.

---

## Fase 5 — subscription-specific flows

### Providers

- `openai`
- `copilot`
- `minimax`

### Werk

1. auth-start flows `accountLabel` laten meenemen
2. callback/poll completion in juiste provider-account record laten landen
3. disconnect per account mogelijk maken
4. flow-state expliciet maken voor parallelle account-auths van dezelfde provider

### Praktisch advies

Doe deze fase liever niet als één grote batch voor alle providers tegelijk.

Veiliger:

1. `openai`
2. `copilot`
3. `minimax`

Dus één generiek account-model, maar subscription/OAuth-device uitrol provider voor provider.

### Resultaat

Ook OAuth/device-code providers kunnen een 2e/3e/4e subscription-account toevoegen.

---

## Opmerking — Nano-GPT hoeft geen aparte fase te zijn

Nano-GPT zit nu in open PR `#1652`, maar nog niet op `main`.

Dat hoeft hier geen aparte implementatiefase te worden.

Als het account-model echt generiek wordt gebouwd, dan moet Nano-GPT automatisch meeliften op dezelfde account-laag als elke andere API-key provider.

Dus alleen borgen:

- geen Nano-GPT-specifieke single-account shortcut introduceren
- Nano-GPT meenemen in tests zodra PR `#1652` landt
- pas bij latere subscription support ook `packages/shared/src/subscription/configs.ts` uitbreiden

---

## Aanbevolen migratiestrategie

### Stap 1: additive + backfill migratie

Voeg eerst velden en indexes toe, inclusief backfill van bestaande rows.

### Stap 2: korte cutover in services

Laat backend-services daarna zo snel mogelijk overschakelen naar:

- `userProviderId` als machine reference
- account-aware cache keys
- account-aware overrides
- account-aware fallbacks

Voorkom een lange dual-read/dual-write periode met twee sources of truth.

### Stap 3: oude aannames snel opruimen

Zodra controllers/services/tests om zijn:

- oude upsert-aannames verwijderen
- oude delete-by-provider-auth shortcuts verwijderen
- oude override-kolommen verwijderen
- fallbacks zonder provider account context verwijderen

---

## Non-goals

Dit plan probeert **niet**:

- alle providers exact dezelfde productfeatures te geven
- subscription te forceren voor providers die dat product niet hebben
- provider-specifieke prijslogica te harmoniseren

Het doel is alleen:

- het platform-model generiek maken
- meerdere accounts voor beide auth types ondersteunen waar relevant

---

## Grootste risico's

1. **Fallbacks blijven ambigu** als ze string-only blijven
2. **OAuth/device flows** worden complexer zodra er meerdere parallelle accounts kunnen worden toegevoegd
3. **Frontend UX** kan onoverzichtelijk worden als account-selectie overal zichtbaar is
4. **Tests** moeten breed mee, omdat bestaande code overal impliciet op single-account leunt
5. **Default-account invariants** worden fragiel zonder partial unique index
6. **Routing cache** kan stil het verkeerde account teruggeven als cache-keys niet naar `userProviderId` gaan

---

## Kort advies

Als dit gebouwd wordt, doe het dan **niet provider voor provider**, maar als één generieke platformrefactor:

1. account-model in `user_providers`
2. account-aware resolution
3. account-aware overrides/fallbacks
4. account-aware UI
5. daarna pas extra providers zoals Nano-GPT aansluiten

Dat is de enige aanpak die het toekomstvast maakt voor:

- 2e account
- 3e account
- 4e account
- API key én subscription
- bestaande providers én nieuwe providers
