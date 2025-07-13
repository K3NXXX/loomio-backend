import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { INestApplication, Module } from '@nestjs/common';
import { Queue } from 'bull';

@Module({})
export class BullBoardModule {
	static setup(app: INestApplication, mailQueue: Queue) {
		const serverAdapter = new ExpressAdapter();
		serverAdapter.setBasePath('/admin/queues');

		createBullBoard({
			queues: [new BullAdapter(mailQueue)],
			serverAdapter,
		});

		app.use('/admin/queues', serverAdapter.getRouter());
	}
}
