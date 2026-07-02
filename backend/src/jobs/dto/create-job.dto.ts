import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsUrl } from 'class-validator';

export class CreateJobDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(1000)
  @IsUrl(
    {
      require_protocol: true,
      require_tld: false,
      protocols: ['http', 'https'],
    },
    { each: true },
  )
  urls: string[];
}
