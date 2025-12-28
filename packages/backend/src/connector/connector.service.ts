import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as mysql from 'mysql2/promise';
import { ConnectorEntity } from './connector.entity';
import type {
  Connector,
  CreateConnectorRequest,
  UpdateConnectorRequest,
  DeleteConnectorResponse,
  MySQLConnectorConfig,
} from '@chatgpt-app-builder/shared';
import { getCategoryFromType } from '@chatgpt-app-builder/shared';
import { encrypt, decrypt, getEncryptionKey } from '../utils/encryption';

export interface TestConnectionResult {
  success: boolean;
  message: string;
}

const PASSWORD_MASK = '********';

@Injectable()
export class ConnectorService {
  constructor(
    @InjectRepository(ConnectorEntity)
    private readonly connectorRepository: Repository<ConnectorEntity>,
  ) {}

  async findAll(): Promise<Connector[]> {
    const entities = await this.connectorRepository.find({
      order: { createdAt: 'DESC' },
    });
    return entities.map((e) => this.entityToConnector(e, true));
  }

  async findById(id: string): Promise<Connector | null> {
    const entity = await this.connectorRepository.findOne({ where: { id } });
    return entity ? this.entityToConnector(entity, true) : null;
  }

  async create(request: CreateConnectorRequest): Promise<Connector> {
    const key = getEncryptionKey();
    const category = getCategoryFromType(request.connectorType);
    const encryptedConfig = encrypt(JSON.stringify(request.config), key);

    const entity = this.connectorRepository.create({
      name: request.name,
      connectorType: request.connectorType,
      category,
      config: encryptedConfig,
    });

    const saved = await this.connectorRepository.save(entity);
    return this.entityToConnector(saved, true);
  }

  async update(id: string, updates: UpdateConnectorRequest): Promise<Connector> {
    const entity = await this.connectorRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Connector with id ${id} not found`);
    }

    const key = getEncryptionKey();

    if (updates.name !== undefined) {
      entity.name = updates.name;
    }

    if (updates.config !== undefined) {
      const existingConfig = JSON.parse(
        decrypt(entity.config, key),
      ) as MySQLConnectorConfig;

      const newConfig: MySQLConnectorConfig = {
        ...existingConfig,
        ...updates.config,
      };

      if (!updates.config.password) {
        newConfig.password = existingConfig.password;
      }

      entity.config = encrypt(JSON.stringify(newConfig), key);
    }

    const saved = await this.connectorRepository.save(entity);
    return this.entityToConnector(saved, true);
  }

  async delete(id: string): Promise<DeleteConnectorResponse> {
    const entity = await this.connectorRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Connector with id ${id} not found`);
    }

    await this.connectorRepository.remove(entity);

    return { success: true, id };
  }

  async testConnection(id: string): Promise<TestConnectionResult> {
    const entity = await this.connectorRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Connector with id ${id} not found`);
    }

    const key = getEncryptionKey();
    const config = JSON.parse(decrypt(entity.config, key)) as MySQLConnectorConfig;

    return this.testMySQLConnection(config);
  }

  async testConnectionWithConfig(config: MySQLConnectorConfig): Promise<TestConnectionResult> {
    return this.testMySQLConnection(config);
  }

  private async testMySQLConnection(config: MySQLConnectorConfig): Promise<TestConnectionResult> {
    try {
      const connection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: config.database,
        connectTimeout: 5000,
      });

      await connection.ping();
      await connection.end();

      return { success: true, message: 'Connection successful' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message: errorMessage };
    }
  }

  private entityToConnector(entity: ConnectorEntity, maskPassword: boolean): Connector {
    const key = getEncryptionKey();
    const config = JSON.parse(decrypt(entity.config, key)) as MySQLConnectorConfig;

    if (maskPassword) {
      config.password = PASSWORD_MASK;
    }

    return {
      id: entity.id,
      name: entity.name,
      connectorType: entity.connectorType,
      category: entity.category,
      config,
      createdAt: entity.createdAt?.toISOString(),
      updatedAt: entity.updatedAt?.toISOString(),
    };
  }
}
