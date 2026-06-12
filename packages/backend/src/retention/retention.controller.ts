import { Body, Controller, Get, Patch } from '@nestjs/common';
import { RetentionService } from './retention.service';
import { SetRetentionDto } from './dto/set-retention.dto';

@Controller('api/v1/message-retention')
export class RetentionController {
	constructor(private readonly service: RetentionService) {}

	@Get()
	async get() {
		return { days: await this.service.getRetentionDays() };
	}

	@Patch()
	async patch(@Body() body: SetRetentionDto) {
		await this.service.setRetentionDays(body.days);
		return { days: body.days };
	}
}
