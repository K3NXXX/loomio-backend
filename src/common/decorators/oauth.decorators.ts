import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

export function GoogleAuthorization() {
	return UseGuards(AuthGuard('google'));
}

export function FacebookAuthorization() {
	return UseGuards(AuthGuard('facebook'));
}

export function GitHubAuthorization() {
	return UseGuards(AuthGuard('github'));
}
