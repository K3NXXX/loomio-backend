import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { PrismaService } from '@/common/prisma/prisma.service'
import { NotificationsGateway } from './notification.gateway'
import { NotificationController } from './notification.controller'

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, PrismaService, NotificationsGateway],
  exports: [NotificationService, NotificationsGateway]
})
export class NotificationModule {}