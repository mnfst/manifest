# Research: MCP App and Flow Data Architecture

**Feature Branch**: `002-mcp-server-flow`
**Date**: 2025-12-26

## Research Topics

### 1. TypeORM Entity Relationships for Hierarchical Data

**Decision**: Use TypeORM `@OneToMany` and `@ManyToOne` decorators with cascade options for App → Flow → View hierarchy.

**Rationale**:
- TypeORM's relation decorators provide clean parent-child modeling
- Cascade insert/update simplifies creation of nested entities
- Eager loading with `relations` option enables single-query fetching of full hierarchy
- Matches existing AppEntity patterns in the codebase

**Pattern**:
```typescript
// Parent entity
@Entity('apps')
export class AppEntity {
  @OneToMany(() => FlowEntity, (flow) => flow.app, { cascade: true })
  flows: FlowEntity[];
}

// Child entity
@Entity('flows')
export class FlowEntity {
  @ManyToOne(() => AppEntity, (app) => app.flows, { onDelete: 'CASCADE' })
  app: AppEntity;

  @Column()
  appId: string;

  @OneToMany(() => ViewEntity, (view) => view.flow, { cascade: true })
  views: ViewEntity[];
}
```

**Alternatives Considered**:
- JSON column with embedded views: Rejected - loses queryability and referential integrity
- Separate join tables: Rejected - adds complexity for simple parent-child relationship
- Document-style storage: Rejected - SQLite doesn't support native JSON querying

---

### 2. View Ordering Strategy

**Decision**: Use integer `order` column with explicit ordering in queries, reordering via batch update.

**Rationale**:
- Simple integer comparison for sorting
- Allows gaps in numbering for easier insertions (e.g., 10, 20, 30)
- Reorder operation updates multiple rows in single transaction
- Matches common patterns for sortable lists

**Pattern**:
```typescript
@Entity('views')
export class ViewEntity {
  @Column({ type: 'int', default: 0 })
  order: number;
}

// Query with ordering
const views = await repo.find({
  where: { flowId },
  order: { order: 'ASC' }
});

// Reorder: batch update with new positions
async reorderViews(flowId: string, viewIds: string[]) {
  await Promise.all(viewIds.map((id, index) =>
    repo.update(id, { order: index * 10 })
  ));
}
```

**Alternatives Considered**:
- Linked list (prev/next pointers): Rejected - complex updates, multiple queries for full list
- Fractional ordering (1.5, 1.25): Rejected - precision issues, complexity
- Array column: Rejected - not well supported in SQLite

---

### 3. Slug Generation Strategy

**Decision**: Use `slugify` library with collision detection (append counter if duplicate exists).

**Rationale**:
- Standard URL-safe transformation (lowercase, hyphens, strip special chars)
- Simple collision handling for POC (not needed for single-app session, but future-proof)
- Matches spec assumption: "lowercase, hyphens, alphanumeric"

**Pattern**:
```typescript
import slugify from 'slugify';

async generateUniqueSlug(name: string): Promise<string> {
  const baseSlug = slugify(name, { lower: true, strict: true });
  let slug = baseSlug;
  let counter = 1;

  while (await this.appRepo.findOne({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}
```

**Note**: For POC with fresh sessions, collision detection is effectively a no-op but provides correct behavior if persistence is later enabled.

**Alternatives Considered**:
- UUID-based slugs: Rejected - not user-friendly URLs
- Timestamp suffix: Rejected - ugly URLs, doesn't prevent same-second collisions
- No slug (use ID): Rejected - spec requires human-readable URL

---

### 4. NestJS Module Organization

**Decision**: Separate modules for Flow and View with proper imports/exports, following existing AppModule pattern.

**Rationale**:
- Single Responsibility: Each module handles its entity lifecycle
- Dependency Injection: Services can be injected across modules via exports
- Follows existing codebase patterns (AppModule, AgentModule)

**Pattern**:
```typescript
// flow.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([FlowEntity])],
  controllers: [FlowController],
  providers: [FlowService],
  exports: [FlowService], // Allow injection in AgentService
})
export class FlowModule {}

// app.module.ts (root)
@Module({
  imports: [
    TypeOrmModule.forRoot({ entities: [AppEntity, FlowEntity, ViewEntity], ... }),
    FlowModule,
    ViewModule,
    AgentModule,
  ],
})
export class AppModule {}
```

**Alternatives Considered**:
- Single mega-module: Rejected - violates Single Responsibility
- Nested modules: Rejected - adds complexity, NestJS prefers flat module structure

---

### 5. React Router Page Structure

**Decision**: Flat route structure with nested params, following existing React Router 7 patterns.

**Rationale**:
- Simple route definitions with dynamic segments
- Params accessible via `useParams()` hook
- Matches existing Editor.tsx pattern

**Pattern**:
```typescript
// App.tsx routes
<Routes>
  <Route path="/" element={<Home />} />
  <Route path="/app/:appId" element={<AppDashboard />} />
  <Route path="/app/:appId/flow/:flowId" element={<FlowEditor />} />
  <Route path="/app/:appId/flow/:flowId/view/:viewId" element={<ViewEditor />} />
</Routes>

// Usage in component
const { appId, flowId, viewId } = useParams();
```

**Alternatives Considered**:
- Outlet-based nested layouts: Could be added later for shared navigation, but adds complexity for POC
- Hash-based routing: Rejected - not SEO-friendly (though not critical for POC)

---

### 6. Session State Management

**Decision**: Maintain in-memory `currentAppId` in backend service (existing pattern), extend to track current flow/view context if needed.

**Rationale**:
- Matches existing POC pattern for session management
- Simple and sufficient for single-user POC
- URL params provide navigation context; backend state provides "active workspace"

**Pattern**:
```typescript
@Injectable()
export class AppService {
  private currentAppId: string | null = null;

  setCurrentApp(appId: string) { this.currentAppId = appId; }
  getCurrentAppId() { return this.currentAppId; }
}
```

**Alternatives Considered**:
- Session storage/cookies: Rejected - adds complexity for POC
- Database session table: Rejected - overkill for single-user POC
- Frontend-only state: Partial adoption - URL params for navigation, backend for current workspace

---

### 7. Agent/LLM Flow Generation

**Decision**: Adapt existing agent tool chain to generate Flow + initial View instead of full App.

**Rationale**:
- Reuses existing LangChain infrastructure
- Tools already generate layout, theme, mock data - redirect output to View entity
- Flow name/description can be LLM-generated from prompt

**Pattern**:
```typescript
// Modified agent flow
async generateFlow(appId: string, prompt: string): Promise<Flow> {
  // 1. Generate flow metadata (name, description) from prompt
  const flowMeta = await this.llm.invoke(flowMetaPrompt(prompt));

  // 2. Create flow entity
  const flow = await this.flowService.create({ appId, ...flowMeta });

  // 3. Generate initial view using existing tools
  const layout = await this.layoutTool.invoke(prompt);
  const mockData = await this.mockDataTool.invoke({ prompt, layout });

  // 4. Create view entity
  await this.viewService.create({
    flowId: flow.id,
    layoutTemplate: layout,
    mockData,
    order: 0
  });

  return flow;
}
```

**Alternatives Considered**:
- New separate agent: Rejected - duplicates existing logic
- Client-side generation: Rejected - requires exposing LLM to frontend

---

## Summary

All research topics resolved with patterns that:
- Follow existing codebase conventions
- Maintain POC simplicity
- Provide clear upgrade paths for post-POC enhancements

No NEEDS CLARIFICATION items remain.
