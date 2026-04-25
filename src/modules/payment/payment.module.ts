import { Module } from '@nestjs/common'
import { PaymentsController } from './payment.controller'
import { PaymentsService } from './payment.service'
import { PrismaModule } from '@/common/prisma/prisma.module'

@Module({
    imports: [PrismaModule],
    controllers: [PaymentsController],
    providers: [PaymentsService],
})
export class PaymentsModule {}