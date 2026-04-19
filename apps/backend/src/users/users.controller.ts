import {
  Controller,
  Get,
  Param,
  Patch,
  Delete,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles('admin')
  findAll() {
    return this.usersService.findAll();
  }

  @Patch('me/profile')
  updateMyProfile(@Request() req: any, @Body() body: { name?: string }) {
    return this.usersService.updateProfile(req.user.id, body);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('avatar', { limits: { fileSize: 2 * 1024 * 1024 } }))
  uploadAvatar(@Request() req: any, @UploadedFile() file: any) {
    return this.usersService.updateAvatar(req.user.id, file);
  }

  @Get('me/panel-account')
  getPanelAccount(@Request() req: any) {
    return this.usersService.getPanelAccount(req.user.id);
  }

  @Post('me/panel-account/reset-password')
  resetPanelPassword(@Request() req: any) {
    return this.usersService.resetPanelPassword(req.user.id);
  }

  @Get(':id')
  @Roles('admin')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id/role')
  @Roles('admin')
  updateRole(@Param('id') id: string, @Body('role') role: string) {
    return this.usersService.updateRole(id, role);
  }

  @Delete(':id')
  @Roles('admin')
  delete(@Param('id') id: string) {
    return this.usersService.delete(id);
  }
}
