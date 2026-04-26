import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';

@Controller('admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  // ── Eggs ──

  @Get('eggs')
  @Permissions('eggs.read')
  listEggs() {
    return this.adminService.listEggs();
  }

  @Post('eggs')
  @Permissions('eggs.write')
  createEgg(@Body() body: any) {
    return this.adminService.createEgg(body);
  }

  @Patch('eggs/:id')
  @Permissions('eggs.write')
  updateEgg(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateEgg(id, body);
  }

  @Delete('eggs/:id')
  @Permissions('eggs.write')
  deleteEgg(@Param('id') id: string) {
    return this.adminService.deleteEgg(id);
  }

  // ── Locations ──

  @Get('locations')
  @Permissions('settings.read')
  listLocations() {
    return this.adminService.listLocations();
  }

  @Post('locations')
  @Permissions('settings.write')
  createLocation(@Body() body: any) {
    return this.adminService.createLocation(body);
  }

  @Patch('locations/:id')
  @Permissions('settings.write')
  updateLocation(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateLocation(id, body);
  }

  @Delete('locations/:id')
  @Permissions('settings.write')
  deleteLocation(@Param('id') id: string) {
    return this.adminService.deleteLocation(id);
  }

  // ── Packages ──

  @Get('packages')
  @Permissions('packages.read')
  listPackages() {
    return this.adminService.listPackages();
  }

  @Post('packages')
  @Permissions('packages.write')
  createPackage(@Body() body: any) {
    return this.adminService.createPackage(body);
  }

  @Patch('packages/:id')
  @Permissions('packages.write')
  updatePackage(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updatePackage(id, body);
  }

  @Delete('packages/:id')
  @Permissions('packages.write')
  deletePackage(@Param('id') id: string) {
    return this.adminService.deletePackage(id);
  }

  // ── Store Items ──

  @Get('store-items')
  @Permissions('store.read')
  listStoreItems() {
    return this.adminService.listStoreItems();
  }

  @Post('store-items')
  @Permissions('store.write')
  upsertStoreItem(@Body() body: any) {
    return this.adminService.upsertStoreItem(body);
  }

  @Delete('store-items/:id')
  @Permissions('store.write')
  deleteStoreItem(@Param('id') id: string) {
    return this.adminService.deleteStoreItem(id);
  }

  // ── User Resources ──

  @Get('user-resources/:userId')
  @Permissions('users.read')
  getUserResources(@Param('userId') userId: string) {
    return this.adminService.getUserResources(userId);
  }

  @Patch('user-resources/:userId')
  @Permissions('users.write')
  updateUserResources(@Param('userId') userId: string, @Body() body: any) {
    return this.adminService.updateUserResources(userId, body);
  }

  // ── Sync from Calagopus ──

  @Post('sync')
  @Permissions('settings.write')
  syncAll() {
    return this.adminService.syncAll();
  }

  @Post('sync/locations')
  @Permissions('settings.write')
  syncLocations() {
    return this.adminService.syncLocations();
  }

  @Post('sync/nodes')
  @Permissions('settings.write')
  syncNodes() {
    return this.adminService.syncNodes();
  }

  @Post('sync/eggs')
  @Permissions('settings.write')
  syncEggs() {
    return this.adminService.syncNestsAndEggs();
  }

  @Post('sync/servers')
  @Permissions('settings.write')
  migrateServers() {
    return this.adminService.migrateServers();
  }

  // ── Nodes (read) ──

  @Get('nodes')
  @Permissions('settings.read')
  listNodes() {
    return this.adminService.listNodes();
  }

  // ── Roles ──

  @Get('roles')
  @Permissions('roles.read')
  listRoles() {
    return this.adminService.listRoles();
  }

  @Get('roles/:id')
  @Permissions('roles.read')
  getRole(@Param('id') id: string) {
    return this.adminService.getRole(id);
  }

  @Post('roles')
  @Permissions('roles.write')
  createRole(@Body() body: any) {
    return this.adminService.createRole(body);
  }

  @Patch('roles/:id')
  @Permissions('roles.write')
  updateRole(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateRole(id, body);
  }

  @Delete('roles/:id')
  @Permissions('roles.delete')
  deleteRole(@Param('id') id: string) {
    return this.adminService.deleteRole(id);
  }

  // ── Permissions ──

  @Get('permissions')
  @Permissions('roles.read')
  listPermissions() {
    return this.adminService.listPermissions();
  }

  // ── User detail ──

  @Get('users/:id')
  @Permissions('users.read')
  getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Patch('users/:id/coins')
  @Permissions('users.write')
  setUserCoins(@Param('id') id: string, @Body('coins') coins: number) {
    return this.adminService.setUserCoins(id, coins);
  }

  @Patch('users/:id/coins/add')
  @Permissions('users.write')
  addUserCoins(@Param('id') id: string, @Body('coins') coins: number) {
    return this.adminService.addUserCoins(id, coins);
  }

  @Patch('users/:id/package')
  @Permissions('users.write')
  setUserPackage(@Param('id') id: string, @Body('packageId') packageId: string | null) {
    return this.adminService.setUserPackage(id, packageId);
  }

  @Patch('users/:id/role')
  @Permissions('users.write')
  setUserRole(@Param('id') id: string, @Body('roleId') roleId: string) {
    return this.adminService.setUserRole(id, roleId);
  }

  @Post('users/:id/verify-email')
  @Permissions('users.write')
  forceVerifyEmail(@Param('id') id: string) {
    return this.adminService.forceVerifyEmail(id);
  }

  @Patch('users/:id/panel-id')
  @Permissions('users.write')
  setUserPanelId(@Param('id') id: string, @Body('calagopusId') calagopusId: string) {
    return this.adminService.updateUserResources(id, { calagopusId });
  }

  // ── Servers (admin) ──

  @Get('servers')
  @Permissions('servers.read')
  listAllServers(@Query('page') page?: string, @Query('perPage') perPage?: string) {
    return this.adminService.listAllServers(
      page ? parseInt(page, 10) : 1,
      perPage ? parseInt(perPage, 10) : 50,
    );
  }

  @Get('servers/:uuid')
  @Permissions('servers.read')
  getServer(@Param('uuid') uuid: string) {
    return this.adminService.getServer(uuid);
  }

  @Patch('servers/:uuid')
  @Permissions('servers.write')
  updateServer(@Param('uuid') uuid: string, @Body() body: any) {
    return this.adminService.updateServer(uuid, body);
  }

  @Get('servers/:uuid/allocations')
  @Permissions('servers.read')
  listServerNodeAllocations(@Param('uuid') uuid: string, @Query('nodeUuid') nodeUuid: string) {
    return this.adminService.listNodeAllocations(nodeUuid);
  }

  @Post('servers/:uuid/suspend')
  @Permissions('servers.write')
  suspendServer(@Param('uuid') uuid: string) {
    return this.adminService.suspendServer(uuid);
  }

  @Post('servers/:uuid/unsuspend')
  @Permissions('servers.write')
  unsuspendServer(@Param('uuid') uuid: string) {
    return this.adminService.unsuspendServer(uuid);
  }

  @Delete('servers/:uuid')
  @Permissions('servers.delete')
  deleteServer(@Param('uuid') uuid: string) {
    return this.adminService.deleteServer(uuid);
  }
}
