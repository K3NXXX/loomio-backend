import { Controller, Headers, HttpCode, Post, Req, Res, UsePipes } from "@nestjs/common"
import { PaymentsService } from "./payment.service"
import { Authorization } from "@/common/decorators/auth.decorators"
import { CurrentUser } from "@/common/decorators/user.decorator"
import { Response } from "express"

@Controller('payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) {}

    @Authorization()
    @Post('create-checkout-session')
    createCheckoutSession(@CurrentUser('id') userId: string) {
        return this.paymentsService.createCheckoutSession(userId)
    }

    @Post('webhook')
    @HttpCode(200)
    @UsePipes()
    async handleWebhook(
        @Req() req: Request & { rawBody: Buffer },
        @Headers('stripe-signature') signature: string,
        @Res() res: Response,
    ) {
        await this.paymentsService.handleWebhook(req.rawBody, signature)
        return res.status(200).json({ received: true })
    }
}