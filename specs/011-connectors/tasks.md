# Tasks: Connectors Entity Management

**Organization**: Tasks grouped by user story for independent implementation.

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Define ConnectorType and ConnectorCategory enums in packages/shared/src/types/connector.ts
- [X] T002 Define MySQLConnectorConfig interface in packages/shared/src/types/connector.ts
- [X] T003 Define Connector, CreateConnectorRequest, UpdateConnectorRequest, DeleteConnectorResponse in packages/shared/src/types/connector.ts
- [X] T004 Export connector types from packages/shared/src/index.ts

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T005 Create encryption utility in packages/backend/src/utils/encryption.ts
- [X] T006 Add CONNECTOR_ENCRYPTION_KEY to packages/backend/.env.example
- [X] T007 Create ConnectorEntity in packages/backend/src/entities/connector.entity.ts
- [X] T008 Register ConnectorEntity in TypeORM entities in packages/backend/src/app/app.module.ts
- [X] T009 Create ConnectorModule in packages/backend/src/connector/connector.module.ts
- [X] T010 Create ConnectorService in packages/backend/src/connector/connector.service.ts
- [X] T011 Create ConnectorController in packages/backend/src/connector/connector.controller.ts
- [X] T012 Register ConnectorModule in AppModule imports

## Phase 3: User Story 1 - View Connectors List (P1)

- [X] T013 Implement findAll() in ConnectorService
- [X] T014 Implement GET /api/connectors endpoint
- [X] T015 Add listConnectors() to API client in packages/frontend/src/lib/api.ts
- [X] T016 Create ConnectorCard component in packages/frontend/src/components/connector/ConnectorCard.tsx
- [X] T017 Create ConnectorList component in packages/frontend/src/components/connector/ConnectorList.tsx
- [X] T018 Create ConnectorsPage in packages/frontend/src/pages/ConnectorsPage.tsx
- [X] T019 Add /connectors route to App.tsx
- [X] T020 Add Connectors sidebar item in packages/frontend/src/components/layout/Sidebar.tsx

## Phase 4: User Story 2 - Create MySQL Connector (P1)

- [X] T021 Implement create() in ConnectorService
- [X] T022 Implement POST /api/connectors endpoint
- [X] T023 Add createConnector() to API client
- [X] T024 Create CreateConnectorModal in packages/frontend/src/components/connector/CreateConnectorModal.tsx
- [X] T025 Integrate CreateConnectorModal with ConnectorsPage

## Phase 5: User Story 3 - Edit Connector (P2)

- [X] T026 Implement findById() in ConnectorService
- [X] T027 Implement update() in ConnectorService
- [X] T028 Implement GET /api/connectors/:id endpoint
- [X] T029 Implement PUT /api/connectors/:id endpoint
- [X] T030 Add updateConnector() to API client
- [X] T031 Create EditConnectorModal in packages/frontend/src/components/connector/EditConnectorModal.tsx
- [X] T032 Add edit action to ConnectorCard
- [X] T033 Integrate EditConnectorModal with ConnectorsPage

## Phase 6: User Story 4 - Delete Connector (P2)

- [X] T034 Implement delete() in ConnectorService
- [X] T035 Implement DELETE /api/connectors/:id endpoint
- [X] T036 Add deleteConnector() to API client
- [X] T037 Add delete action to ConnectorCard
- [X] T038 Integrate DeleteConfirmDialog with ConnectorsPage

## Phase 7: Polish

- [X] T039 Add loading states to ConnectorsPage
- [X] T040 Add error handling to ConnectorsPage
