import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CreateJobDto } from './dto/create-job.dto';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  create(@Body() dto: CreateJobDto) {
    return this.jobsService.create(dto.urls);
  }

  @Get()
  list() {
    return this.jobsService.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.jobsService.get(id);
  }

  @Delete(':id')
  cancel(@Param('id') id: string) {
    return this.jobsService.cancel(id);
  }
}
