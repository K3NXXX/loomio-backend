import { PartialType } from '@nestjs/mapped-types';
import { CreateProjectDto } from './create.dto';

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
