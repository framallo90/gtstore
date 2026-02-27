import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSiteContentDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  homeHeroTag?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  homeHeroTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  homeHeroCopy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  homeFlashTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  homeFlashCopy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  homeRecoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  homeRecoCopy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  catalogTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  catalogCopy?: string;
}
