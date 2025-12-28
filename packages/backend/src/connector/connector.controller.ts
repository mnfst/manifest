import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConnectorService, TestConnectionResult } from './connector.service';
import type {
  Connector,
  CreateConnectorRequest,
  UpdateConnectorRequest,
  DeleteConnectorResponse,
} from '@chatgpt-app-builder/shared';
import { ConnectorType } from '@chatgpt-app-builder/shared';

@Controller('api/connectors')
export class ConnectorController {
  constructor(private readonly connectorService: ConnectorService) {}

  @Get()
  async listConnectors(): Promise<Connector[]> {
    return this.connectorService.findAll();
  }

  @Get(':id')
  async getConnector(@Param('id') id: string): Promise<Connector> {
    const connector = await this.connectorService.findById(id);
    if (!connector) {
      throw new NotFoundException(`Connector with id ${id} not found`);
    }
    return connector;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createConnector(@Body() request: CreateConnectorRequest): Promise<Connector> {
    if (!request.name || request.name.trim().length === 0) {
      throw new BadRequestException('Name is required');
    }
    if (request.name.length > 100) {
      throw new BadRequestException('Name must be 100 characters or less');
    }
    if (!request.connectorType) {
      throw new BadRequestException('Connector type is required');
    }
    if (request.connectorType !== ConnectorType.MYSQL) {
      throw new BadRequestException('Only MySQL connector type is supported');
    }
    if (!request.config) {
      throw new BadRequestException('Config is required');
    }

    const config = request.config;
    if (!config.host?.trim()) {
      throw new BadRequestException('Host is required');
    }
    if (!config.port || config.port < 1 || config.port > 65535) {
      throw new BadRequestException('Port must be between 1 and 65535');
    }
    if (!config.database?.trim()) {
      throw new BadRequestException('Database name is required');
    }
    if (!config.username?.trim()) {
      throw new BadRequestException('Username is required');
    }
    if (!config.password?.trim()) {
      throw new BadRequestException('Password is required');
    }

    return this.connectorService.create(request);
  }

  @Put(':id')
  async updateConnector(
    @Param('id') id: string,
    @Body() request: UpdateConnectorRequest,
  ): Promise<Connector> {
    if (request.name !== undefined) {
      if (request.name.trim().length === 0) {
        throw new BadRequestException('Name cannot be empty');
      }
      if (request.name.length > 100) {
        throw new BadRequestException('Name must be 100 characters or less');
      }
    }
    if (request.config?.port !== undefined) {
      if (request.config.port < 1 || request.config.port > 65535) {
        throw new BadRequestException('Port must be between 1 and 65535');
      }
    }

    return this.connectorService.update(id, request);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteConnector(@Param('id') id: string): Promise<DeleteConnectorResponse> {
    return this.connectorService.delete(id);
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  async testConnection(@Param('id') id: string): Promise<TestConnectionResult> {
    return this.connectorService.testConnection(id);
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  async testConnectionWithConfig(
    @Body() config: { host: string; port: number; database: string; username: string; password: string },
  ): Promise<TestConnectionResult> {
    if (!config.host?.trim()) {
      return { success: false, message: 'Host is required' };
    }
    if (!config.port || config.port < 1 || config.port > 65535) {
      return { success: false, message: 'Port must be between 1 and 65535' };
    }
    if (!config.database?.trim()) {
      return { success: false, message: 'Database name is required' };
    }
    if (!config.username?.trim()) {
      return { success: false, message: 'Username is required' };
    }
    if (!config.password?.trim()) {
      return { success: false, message: 'Password is required' };
    }

    return this.connectorService.testConnectionWithConfig({
      host: config.host.trim(),
      port: config.port,
      database: config.database.trim(),
      username: config.username.trim(),
      password: config.password.trim(),
    });
  }
}
