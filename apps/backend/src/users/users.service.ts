import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service.js';
import { CalagopusService } from '../pelican/pelican.service.js';
import { randomUUID } from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private calagopus: CalagopusService,
  ) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      role: user.role.name,
      permissions: user.role.permissions.map((rp) => rp.permission.name),
      createdAt: user.createdAt,
    }));
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      role: user.role.name,
      permissions: user.role.permissions.map((rp) => rp.permission.name),
      createdAt: user.createdAt,
    };
  }

  async updateRole(userId: string, roleName: string) {
    const role = await this.prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { roleId: role.id },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      role: user.role.name,
      permissions: user.role.permissions.map((rp) => rp.permission.name),
    };
  }

  async delete(id: string) {
    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted successfully' };
  }

  async updateProfile(userId: string, data: { name?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { name: data.name },
    });
    return { id: user.id, email: user.email, name: user.name, avatar: user.avatar };
  }

  async updateAvatar(userId: string, file: any) {
    if (!file) throw new BadRequestException('No file uploaded');
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
      throw new BadRequestException('Invalid file type');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('File too large (max 2MB)');
    }

    const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `${userId}${ext}`;
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, file.buffer);

    const avatarUrl = `/uploads/avatars/${filename}`;
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
    });

    return { avatar: avatarUrl };
  }

  async getPanelAccount(userId: string) {
    const resources = await this.prisma.userResources.findUnique({ where: { userId } });
    if (!resources?.calagopusId) {
      return { linked: false, calagopusId: null, username: null, email: null };
    }
    try {
      const data = await this.calagopus.getUserByUuid(resources.calagopusId);
      const user = data?.user ?? data;
      return {
        linked: true,
        calagopusId: resources.calagopusId,
        username: user?.username ?? null,
        email: user?.email ?? null,
      };
    } catch {
      return { linked: true, calagopusId: resources.calagopusId, username: null, email: null };
    }
  }

  async resetPanelPassword(userId: string) {
    const resources = await this.prisma.userResources.findUnique({ where: { userId } });
    if (!resources?.calagopusId) {
      throw new BadRequestException('No linked panel account');
    }
    const newPassword = randomUUID().slice(0, 16);
    try {
      await this.calagopus.updateUser(resources.calagopusId, { password: newPassword });
      return { password: newPassword };
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Failed to reset panel password');
    }
  }
}
