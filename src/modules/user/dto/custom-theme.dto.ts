import { Matches } from 'class-validator';

const HEX6 = /^#[0-9A-Fa-f]{6}$/;

export class UpdateCustomThemeDto {
	@Matches(HEX6, { message: 'background must be a 6-digit hex color' })
	background: string;

	@Matches(HEX6, { message: 'primary must be a 6-digit hex color' })
	primary: string;
}
