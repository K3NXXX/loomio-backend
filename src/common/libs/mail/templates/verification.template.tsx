import { Body, Container, Head, Heading, Section, Tailwind, Text } from '@react-email/components';
import { Html } from '@react-email/html';
import * as React from 'react';

export function VerificationTemplate(code: string) {
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
							<Heading className='text-xl font-semibold mb-2'>Verify your email</Heading>
							<Text className='text-sm text-neutral-600 mb-6'>
								Use the code below to verify your email address.
							</Text>
							<Text className='text-2xl font-mono font-bold tracking-widest py-4 px-6 bg-neutral-100 rounded-md inline-block'>
								{code}
							</Text>
							<Text className='text-sm text-neutral-500 mt-6'>
								This code will expire in 10 minutes. If you didn’t request this, you can safely
								ignore this email.
							</Text>
							<Text className='text-xs text-neutral-400 mt-8'>
								&copy; {new Date().getFullYear()} NEXTGEN. All rights reserved.
							</Text>
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}
