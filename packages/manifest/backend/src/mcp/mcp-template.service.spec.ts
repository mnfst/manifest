import { NotFoundException } from '@nestjs/common';
import { McpTemplateService } from './mcp-template.service';
import { McpToolService } from './mcp.tool';
import { AppService } from '../app/app.service';
import type { Repository } from 'typeorm';
import type { FlowEntity } from '../flow/flow.entity';

const mockReadFileSync = jest.fn(() => '<html>{{appName}} {{flowName}} {{themeVariables}}</html>');

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
}));

describe('McpTemplateService', () => {
  let service: McpTemplateService;
  let mcpToolService: Partial<McpToolService>;
  let appService: Partial<AppService>;
  let flowRepository: Partial<Repository<FlowEntity>>;

  beforeEach(() => {
    mockReadFileSync.mockReturnValue('<html>{{appName}} {{flowName}} {{themeVariables}}</html>');

    mcpToolService = {
      getAppBySlug: jest.fn(),
      listTools: jest.fn().mockResolvedValue([]),
    };
    appService = {
      findBySlug: jest.fn(),
    };
    flowRepository = {
      findOne: jest.fn(),
    };

    service = new McpTemplateService(
      mcpToolService as McpToolService,
      appService as AppService,
      flowRepository as Repository<FlowEntity>,
    );
  });

  describe('renderUiTemplate', () => {
    it('should throw NotFoundException when app not found', async () => {
      (mcpToolService.getAppBySlug as jest.Mock).mockResolvedValue(null);

      await expect(service.renderUiTemplate('missing', 'tool', 'layout')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when flow not found', async () => {
      (mcpToolService.getAppBySlug as jest.Mock).mockResolvedValue({ id: '1', themeVariables: {} });
      (flowRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.renderUiTemplate('test', 'missing-tool', 'layout')).rejects.toThrow(NotFoundException);
    });

    it('should return rendered HTML for valid request', async () => {
      (mcpToolService.getAppBySlug as jest.Mock).mockResolvedValue({
        id: '1',
        name: 'TestApp',
        themeVariables: { '--color': '#fff' },
      });
      (flowRepository.findOne as jest.Mock).mockResolvedValue({
        name: 'TestFlow',
        views: [{ order: 0, layoutTemplate: 'layout' }],
      });

      const html = await service.renderUiTemplate('test', 'tool', 'layout');

      expect(html).toContain('TestApp');
      expect(html).toContain('TestFlow');
      expect(html).toContain('--color: #fff;');
    });
  });

  describe('renderLandingPage', () => {
    it('should throw NotFoundException when app not found', async () => {
      (appService.findBySlug as jest.Mock).mockResolvedValue(null);

      await expect(service.renderLandingPage('missing', 'localhost')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for draft apps', async () => {
      (appService.findBySlug as jest.Mock).mockResolvedValue({ status: 'draft' });

      await expect(service.renderLandingPage('test', 'localhost')).rejects.toThrow(NotFoundException);
    });

    it('should return rendered HTML for published app', async () => {
      mockReadFileSync.mockReturnValue(
        '<html>{{appName}} {{appDescription}} {{mcpUrl}} {{toolsList}} {{themeVariables}}</html>',
      );

      (appService.findBySlug as jest.Mock).mockResolvedValue({
        name: 'TestApp',
        description: 'A test app',
        slug: 'test',
        status: 'published',
        themeVariables: {},
      });
      (mcpToolService.listTools as jest.Mock).mockResolvedValue([]);

      const html = await service.renderLandingPage('test', 'example.com');

      expect(html).toContain('TestApp');
      expect(html).toContain('A test app');
      expect(html).toContain('example.com');
    });
  });
});
