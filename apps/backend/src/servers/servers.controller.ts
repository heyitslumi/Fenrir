import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { ServersService } from './servers.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('servers')
@UseGuards(JwtAuthGuard)
export class ServersController {
  constructor(private serversService: ServersService) {}

  @Get()
  @SkipThrottle()
  async listMyServers(@Request() req: any) {
    return this.serversService.listUserServers(req.user.id);
  }

  @Post()
  @Throttle({ short: { ttl: 30000, limit: 3 }, medium: { ttl: 300000, limit: 5 }, long: { ttl: 1800000, limit: 10 } })
  async createServer(@Request() req: any, @Body() body: any) {
    return this.serversService.createServer(req.user.id, body);
  }

  @Get('stats')
  async getStats() {
    return this.serversService.getStats();
  }

  @Get('eggs')
  async getEggs(@Request() req: any) {
    return this.serversService.getAvailableEggs(req.user.id);
  }

  @Get('locations')
  async getLocations() {
    return this.serversService.getAvailableLocations();
  }

  @Get('packages')
  async getPackages() {
    return this.serversService.getAvailablePackages();
  }

  // ── Server detail ──

  @Get(':uuid')
  @SkipThrottle()
  async getServerDetail(@Request() req: any, @Param('uuid') uuid: string) {
    return this.serversService.getServerDetail(req.user.id, uuid);
  }

  @Patch(':uuid')
  @Throttle({ short: { ttl: 5000, limit: 2 }, medium: { ttl: 60000, limit: 10 } })
  async modifyServer(
    @Request() req: any,
    @Param('uuid') uuid: string,
    @Body() body: { ram: number; disk: number; cpu: number },
  ) {
    return this.serversService.modifyServer(req.user.id, uuid, body);
  }

  @Delete(':uuid')
  @Throttle({ short: { ttl: 10000, limit: 1 }, medium: { ttl: 60000, limit: 3 } })
  async deleteServer(@Request() req: any, @Param('uuid') uuid: string) {
    return this.serversService.deleteServer(req.user.id, uuid);
  }

  // ── Power & Command ──

  @Post(':uuid/power')
  @Throttle({ short: { ttl: 3000, limit: 2 }, medium: { ttl: 30000, limit: 10 } })
  async sendPowerAction(
    @Request() req: any,
    @Param('uuid') uuid: string,
    @Body() body: { action: 'start' | 'stop' | 'restart' | 'kill' },
  ) {
    return this.serversService.sendPowerAction(req.user.id, uuid, body.action);
  }

  @Post(':uuid/command')
  async sendCommand(
    @Request() req: any,
    @Param('uuid') uuid: string,
    @Body() body: { command: string },
  ) {
    return this.serversService.sendCommand(req.user.id, uuid, body.command);
  }

  // ── WebSocket ──

  @Get(':uuid/websocket')
  @SkipThrottle()
  async getWebsocket(@Request() req: any, @Param('uuid') uuid: string) {
    return this.serversService.getWebsocket(req.user.id, uuid);
  }

  // ── Resources ──

  @Get(':uuid/resources')
  @SkipThrottle()
  async getResources(@Request() req: any, @Param('uuid') uuid: string) {
    return this.serversService.getServerResources(req.user.id, uuid);
  }

  // ── Files ──

  @Get(':uuid/files/list')
  async listFiles(
    @Request() req: any,
    @Param('uuid') uuid: string,
    @Query('directory') directory: string,
  ) {
    return this.serversService.listFiles(req.user.id, uuid, directory || '/');
  }

  @Get(':uuid/files/contents')
  async getFileContents(
    @Request() req: any,
    @Param('uuid') uuid: string,
    @Query('file') file: string,
  ) {
    return this.serversService.getFileContents(req.user.id, uuid, file);
  }

  @Post(':uuid/files/write')
  async writeFile(
    @Request() req: any,
    @Param('uuid') uuid: string,
    @Body() body: { file: string; content: string },
  ) {
    return this.serversService.writeFile(req.user.id, uuid, body.file, body.content);
  }

  @Post(':uuid/files/create-directory')
  async createDirectory(
    @Request() req: any,
    @Param('uuid') uuid: string,
    @Body() body: { root: string; name: string },
  ) {
    return this.serversService.createDirectory(req.user.id, uuid, body.root, body.name);
  }

  @Post(':uuid/files/delete')
  async deleteFiles(
    @Request() req: any,
    @Param('uuid') uuid: string,
    @Body() body: { root: string; files: string[] },
  ) {
    return this.serversService.deleteFiles(req.user.id, uuid, body.root, body.files);
  }

  @Put(':uuid/files/rename')
  async renameFiles(
    @Request() req: any,
    @Param('uuid') uuid: string,
    @Body() body: { root: string; files: { from: string; to: string }[] },
  ) {
    return this.serversService.renameFiles(req.user.id, uuid, body.root, body.files);
  }

  @Post(':uuid/files/compress')
  async compressFiles(
    @Request() req: any,
    @Param('uuid') uuid: string,
    @Body() body: { root: string; files: string[] },
  ) {
    return this.serversService.compressFiles(req.user.id, uuid, body.root, body.files);
  }

  @Post(':uuid/files/decompress')
  async decompressFile(
    @Request() req: any,
    @Param('uuid') uuid: string,
    @Body() body: { root: string; file: string },
  ) {
    return this.serversService.decompressFile(req.user.id, uuid, body.root, body.file);
  }

  @Get(':uuid/files/download')
  async getFileDownloadUrl(
    @Request() req: any,
    @Param('uuid') uuid: string,
    @Query('file') file: string,
  ) {
    return this.serversService.getFileDownloadUrl(req.user.id, uuid, file);
  }

  @Get(':uuid/files/upload')
  async getFileUploadUrl(@Request() req: any, @Param('uuid') uuid: string) {
    return this.serversService.getFileUploadUrl(req.user.id, uuid);
  }

  // ── Backups ──

  @Get(':uuid/backups')
  async listBackups(@Request() req: any, @Param('uuid') uuid: string) {
    return this.serversService.listBackups(req.user.id, uuid);
  }

  @Post(':uuid/backups')
  async createBackup(
    @Request() req: any,
    @Param('uuid') uuid: string,
    @Body() body: { name?: string },
  ) {
    return this.serversService.createBackup(req.user.id, uuid, body.name);
  }

  @Delete(':uuid/backups/:backupUuid')
  async deleteBackup(
    @Request() req: any,
    @Param('uuid') uuid: string,
    @Param('backupUuid') backupUuid: string,
  ) {
    return this.serversService.deleteBackup(req.user.id, uuid, backupUuid);
  }

  @Get(':uuid/backups/:backupUuid/download')
  async downloadBackup(
    @Request() req: any,
    @Param('uuid') uuid: string,
    @Param('backupUuid') backupUuid: string,
  ) {
    return this.serversService.downloadBackup(req.user.id, uuid, backupUuid);
  }

  @Post(':uuid/backups/:backupUuid/restore')
  async restoreBackup(
    @Request() req: any,
    @Param('uuid') uuid: string,
    @Param('backupUuid') backupUuid: string,
  ) {
    return this.serversService.restoreBackup(req.user.id, uuid, backupUuid);
  }

  // ── Startup Variables ──

  @Get(':uuid/startup')
  async getStartupVariables(@Request() req: any, @Param('uuid') uuid: string) {
    return this.serversService.getStartupVariables(req.user.id, uuid);
  }

  @Put(':uuid/startup')
  async updateStartupVariables(
    @Request() req: any,
    @Param('uuid') uuid: string,
    @Body() body: Record<string, string>,
  ) {
    return this.serversService.updateStartupVariables(req.user.id, uuid, body);
  }

  @Put(':uuid/docker-image')
  async updateDockerImage(
    @Request() req: any,
    @Param('uuid') uuid: string,
    @Body() body: { image: string },
  ) {
    return this.serversService.updateDockerImage(req.user.id, uuid, body.image);
  }

  // ── Plugins ──

  @Post(':uuid/plugins/install')
  @Throttle({ short: { ttl: 10000, limit: 3 }, medium: { ttl: 60000, limit: 10 } })
  async installPlugin(
    @Request() req: any,
    @Param('uuid') uuid: string,
    @Body() body: { downloadUrl: string; filename: string },
  ) {
    return this.serversService.installPlugin(req.user.id, uuid, body.downloadUrl, body.filename);
  }

  // ── Settings ──

  @Post(':uuid/rename')
  async renameServer(
    @Request() req: any,
    @Param('uuid') uuid: string,
    @Body() body: { name: string },
  ) {
    return this.serversService.renameServer(req.user.id, uuid, body.name);
  }

  @Post(':uuid/reinstall')
  @Throttle({ short: { ttl: 30000, limit: 1 }, medium: { ttl: 300000, limit: 2 } })
  async reinstallServer(@Request() req: any, @Param('uuid') uuid: string, @Body() body: { truncate_directory?: boolean }) {
    return this.serversService.reinstallServer(req.user.id, uuid, body.truncate_directory ?? true);
  }

  // ── Activity ──

  @Get(':uuid/activity')
  async getActivity(
    @Request() req: any,
    @Param('uuid') uuid: string,
    @Query('page') page: string,
  ) {
    return this.serversService.getActivity(req.user.id, uuid, page ? parseInt(page) : 1);
  }
}
