import { Module } from '@nestjs/common'
import { PaymentsController } from './payment.controller'
import { PaymentsService } from './payment.service'
import { PrismaModule } from '@/common/prisma/prisma.module'
import { UserModule } from '@/modules/user/user.module'

@Module({
    imports: [PrismaModule, UserModule],
    controllers: [PaymentsController],
    providers: [PaymentsService],
})
export class PaymentsModule {}