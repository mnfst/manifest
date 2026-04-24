import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { AgentMessage } from '../entities/agent-message.entity';
import { LlmCall } from '../entities/llm-call.entity';
import { ToolExecution } from '../entities/tool-execution.entity';
import { AgentLog } from '../entities/agent-log.entity';
import { ApiKey } from '../entities/api-key.entity';
import { Tenant } from '../entities/tenant.entity';
import { Agent } from '../entities/agent.entity';
import { AgentApiKey } from '../entities/agent-api-key.entity';
import { NotificationRule } from '../entities/notification-rule.entity';
import { NotificationLog } from '../entities/notification-log.entity';
import { EmailProviderConfig } from '../entities/email-provider-config.entity';
import { UserProvider } from '../entities/user-provider.entity';
import { TierAssignment } from '../entities/tier-assignment.entity';
import { CustomProvider } from '../entities/custom-provider.entity';
import { SpecificityAssignment } from '../entities/specificity-assignment.entity';
import { HeaderTier } from '../entities/header-tier.entity';
import { InstallMetadata } from '../entities/install-metadata.entity';
import { DatabaseSeederService } from './database-seeder.service';
import { ModelPricesModule } from '../model-prices/model-prices.module';
import { InitialSchema1771464895790 } from './migrations/1771464895790-InitialSchema';
import { HashApiKeys1771500000000 } from './migrations/1771500000000-HashApiKeys';
import { ModelPricingImprovements1771600000000 } from './migrations/1771600000000-ModelPricingImprovements';
import { EmailProviderConfigs1771700000000 } from './migrations/1771700000000-EmailProviderConfigs';
import { AddNotificationEmailAndOptionalDomain1771800000000 } from './migrations/1771800000000-AddNotificationEmailAndOptionalDomain';
import { AddModelCapabilities1771600000000 } from './migrations/1771600000000-AddModelCapabilities';
import { AddRoutingTables1771700000000 } from './migrations/1771700000000-AddRoutingTables';
import { AddQualityScore1771800000000 } from './migrations/1771800000000-AddQualityScore';
import { SeedQualityScores1771800100000 } from './migrations/1771800100000-SeedQualityScores';
import { EncryptApiKeys1771900000000 } from './migrations/1771900000000-EncryptApiKeys';
import { MakeApiKeyNullable1772000000000 } from './migrations/1772000000000-MakeApiKeyNullable';
import { AddRoutingTier1772100000000 } from './migrations/1772100000000-AddRoutingTier';
import { AddLimitAction1772200000000 } from './migrations/1772200000000-AddLimitAction';
import { AddRoutingReason1772300000000 } from './migrations/1772300000000-AddRoutingReason';
import { AddAgentDisplayName1772400000000 } from './migrations/1772400000000-AddAgentDisplayName';
import { PerAgentRouting1772500000000 } from './migrations/1772500000000-PerAgentRouting';
import { AddCustomProviders1772668898071 } from './migrations/1772668898071-AddCustomProviders';
import { NullablePricing1772682112419 } from './migrations/1772682112419-NullablePricing';
import { AddPerformanceIndexes1772843035514 } from './migrations/1772843035514-AddPerformanceIndexes';
import { AddProviderAuthType1772900000000 } from './migrations/1772900000000-AddProviderAuthType';
import { AddDashboardIndexes1772905146384 } from './migrations/1772905146384-AddDashboardIndexes';
import { AddFallbacks1772905260464 } from './migrations/1772905260464-AddFallbacks';
import { AddModelDisplayName1772920000000 } from './migrations/1772920000000-AddModelDisplayName';
import { DropRedundantIndexes1772940000000 } from './migrations/1772940000000-DropRedundantIndexes';
import { BackfillTenantId1772948502780 } from './migrations/1772948502780-BackfillTenantId';
import { DropUnusedIndexes1772960000000 } from './migrations/1772960000000-DropUnusedIndexes';
import { PurgeNonCuratedModels1772960000000 } from './migrations/1772960000000-PurgeNonCuratedModels';
import { ExpandProviderUniqueKey1773000000000 } from './migrations/1773000000000-ExpandProviderUniqueKey';
import { AddOverrideAuthType1773100000000 } from './migrations/1773100000000-AddOverrideAuthType';
import { AddMessageAuthType1773200000000 } from './migrations/1773200000000-AddMessageAuthType';
import { AddModelsAgentIndex1773202787708 } from './migrations/1773202787708-AddModelsAgentIndex';
import { AddEmailProviderKeyPrefix1773300000000 } from './migrations/1773300000000-AddEmailProviderKeyPrefix';
import { AddProviderModelCache1773400000000 } from './migrations/1773400000000-AddProviderModelCache';
import { DropModelPricingTables1773500000000 } from './migrations/1773500000000-DropModelPricingTables';
import { AddOverrideProvider1773600000000 } from './migrations/1773600000000-AddOverrideProvider';
import { AddProviderRegion1773650000000 } from './migrations/1773650000000-AddProviderRegion';
import { DropSecurityEventTable1773700000000 } from './migrations/1773700000000-DropSecurityEventTable';
import { FixNegativeCosts1773800000000 } from './migrations/1773800000000-FixNegativeCosts';
import { AddKeyPrefixIndex1773900000000 } from './migrations/1773900000000-AddKeyPrefixIndex';
import { WidenKeyHashColumn1774000000000 } from './migrations/1774000000000-WidenKeyHashColumn';
import { WidenApiKeyColumn1774896789000 } from './migrations/1774896789000-WidenApiKeyColumn';
import { AddErrorHttpStatus1775000000000 } from './migrations/1775000000000-AddErrorHttpStatus';
import { AddAgentType1775100000000 } from './migrations/1775100000000-AddAgentType';
import { AddSpecificityAssignments1775200000000 } from './migrations/1775200000000-AddSpecificityAssignments';
import { AddSpecificityCategory1775300000000 } from './migrations/1775300000000-AddSpecificityCategory';
import { AddCallerAttribution1775400000000 } from './migrations/1775400000000-AddCallerAttribution';
import { AddMessageProvider1775500000000 } from './migrations/1775500000000-AddMessageProvider';
import { AddMessageFeedback1775600000000 } from './migrations/1775600000000-AddMessageFeedback';
import { AddInstallMetadata1775700000000 } from './migrations/1775700000000-AddInstallMetadata';
import { CleanupOrphanedCustomProviderRefs1776679833383 } from './migrations/1776679833383-CleanupOrphanedCustomProviderRefs';
import { AddMessageRequestHeaders1776700000000 } from './migrations/1776700000000-AddMessageRequestHeaders';
import { AddHeaderTiers1776710000000 } from './migrations/1776710000000-AddHeaderTiers';
import { AddSpecificityMiscategorized1777000000000 } from './migrations/1777000000000-AddSpecificityMiscategorized';
import { AddComplexityRoutingFlag1777100000000 } from './migrations/1777100000000-AddComplexityRoutingFlag';
import { AddHeaderTierEnabled1777100000000 } from './migrations/1777100000000-AddHeaderTierEnabled';
import { CanonicalizeTileProviderMessages1777200000000 } from './migrations/1777200000000-CanonicalizeTileProviderMessages';
import { BackfillLocalAuthType1777200000000 } from './migrations/1777200000000-BackfillLocalAuthType';
import { BackfillLocalCustomProviders1777300000000 } from './migrations/1777300000000-BackfillLocalCustomProviders';
import { DropComplexityRoutingFlag1780000000000 } from './migrations/1780000000000-DropComplexityRoutingFlag';
import { ReAddComplexityRoutingFlag1781000000000 } from './migrations/1781000000000-ReAddComplexityRoutingFlag';

const entities = [
  AgentMessage,
  LlmCall,
  ToolExecution,
  AgentLog,
  ApiKey,
  Tenant,
  Agent,
  AgentApiKey,
  NotificationRule,
  NotificationLog,
  EmailProviderConfig,
  UserProvider,
  TierAssignment,
  CustomProvider,
  SpecificityAssignment,
  HeaderTier,
  InstallMetadata,
];

const migrations = [
  InitialSchema1771464895790,
  HashApiKeys1771500000000,
  ModelPricingImprovements1771600000000,
  EmailProviderConfigs1771700000000,
  AddNotificationEmailAndOptionalDomain1771800000000,
  AddModelCapabilities1771600000000,
  AddRoutingTables1771700000000,
  AddQualityScore1771800000000,
  SeedQualityScores1771800100000,
  EncryptApiKeys1771900000000,
  MakeApiKeyNullable1772000000000,
  AddRoutingTier1772100000000,
  AddLimitAction1772200000000,
  AddRoutingReason1772300000000,
  AddAgentDisplayName1772400000000,
  PerAgentRouting1772500000000,
  AddCustomProviders1772668898071,
  NullablePricing1772682112419,
  AddPerformanceIndexes1772843035514,
  AddProviderAuthType1772900000000,
  AddDashboardIndexes1772905146384,
  AddFallbacks1772905260464,
  AddModelDisplayName1772920000000,
  DropRedundantIndexes1772940000000,
  BackfillTenantId1772948502780,
  DropUnusedIndexes1772960000000,
  PurgeNonCuratedModels1772960000000,
  ExpandProviderUniqueKey1773000000000,
  AddOverrideAuthType1773100000000,
  AddMessageAuthType1773200000000,
  AddModelsAgentIndex1773202787708,
  AddEmailProviderKeyPrefix1773300000000,
  AddProviderModelCache1773400000000,
  DropModelPricingTables1773500000000,
  AddOverrideProvider1773600000000,
  AddProviderRegion1773650000000,
  DropSecurityEventTable1773700000000,
  FixNegativeCosts1773800000000,
  AddKeyPrefixIndex1773900000000,
  WidenKeyHashColumn1774000000000,
  WidenApiKeyColumn1774896789000,
  AddErrorHttpStatus1775000000000,
  AddAgentType1775100000000,
  AddSpecificityAssignments1775200000000,
  AddSpecificityCategory1775300000000,
  AddCallerAttribution1775400000000,
  AddMessageProvider1775500000000,
  AddMessageFeedback1775600000000,
  AddInstallMetadata1775700000000,
  CleanupOrphanedCustomProviderRefs1776679833383,
  AddMessageRequestHeaders1776700000000,
  AddHeaderTiers1776710000000,
  AddSpecificityMiscategorized1777000000000,
  AddComplexityRoutingFlag1777100000000,
  AddHeaderTierEnabled1777100000000,
  CanonicalizeTileProviderMessages1777200000000,
  BackfillLocalAuthType1777200000000,
  BackfillLocalCustomProviders1777300000000,
  DropComplexityRoutingFlag1780000000000,
  ReAddComplexityRoutingFlag1781000000000,
];

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('app.databaseUrl'),
        entities,
        synchronize: false,
        // Run migrations on every boot. `synchronize: false` is permanent, so
        // committed migrations are the only source of schema changes — there's
        // no scenario where production should boot with pending migrations
        // unapplied (the dashboard 500s on missing tables). Previously this
        // was gated on AUTO_MIGRATE=true / NODE_ENV, which broke fresh
        // production installs whose env didn't set the var (see #1551 / 5.45.1).
        migrationsRun: true,
        migrationsTransactionMode: 'all' as const,
        migrations,
        logging: false,
        extra: {
          max: config.get<number>('app.dbPoolMax') ?? 20,
          idleTimeoutMillis: 30000,
        },
      }),
    }),
    TypeOrmModule.forFeature([
      Tenant,
      Agent,
      AgentApiKey,
      AgentMessage,
      ApiKey,
      UserProvider,
      TierAssignment,
      CustomProvider,
      SpecificityAssignment,
      HeaderTier,
    ]),
    ModelPricesModule,
  ],
  providers: [DatabaseSeederService],
  exports: [DatabaseSeederService],
})
export class DatabaseModule {}
