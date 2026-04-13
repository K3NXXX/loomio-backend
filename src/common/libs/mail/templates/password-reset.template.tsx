import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Section,
	Tailwind,
	Text,
} from '@react-email/components';
import { Html } from '@react-email/html';
import * as React from 'react';

export function PasswordResetTemplate(token: string, domain: string) {
	const resetUrl = `${domain}/password-reset?token=${token}`;

	return (
		<Html>
			<Head />
			<Tailwind>
				<Body className='bg-neutral-100 text-neutral-900 font-sans flex justify-center items-center py-10'>
					<Container className='w-full max-w-lg p-8 bg-white rounded-2xl shadow-md'>
						<Section className='text-center'>
							<img
								src='https://vercel.com/favicon.ico'
								width='40'
								height='40'
								alt='Logo'
								className='mx-auto mb-4'
							/>
							<Heading className='text-xl font-semibold mb-2'>Reset your password</Heading>
							<Text className='text-sm text-neutral-600 mb-6'>
								Click the button below to reset your password. This link will expire in 10 minutes.
							</Text>
							<div className='mt-4 mb-6'>
								<Button
									href={resetUrl}
									className='bg-black text-white text-sm font-semibold py-3 px-6 rounded-md'
								>
									Reset Password
								</Button>
							</div>
							<Text className='text-sm text-neutral-500'>
								If you didn’t request a password reset, you can safely ignore this email.
							</Text>
							<Text className='text-xs text-neutral-400 mt-8'>
								&copy; {new Date().getFullYear()} LOOMIO. All rights reserved.
							</Text>
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}
