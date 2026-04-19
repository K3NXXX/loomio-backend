import { IsEnum } from 'class-validator'
import { Locale } from '@prisma/client'

export class UpdateLocaleDto {
	@IsEnum(Locale)
	locale: Locale
}