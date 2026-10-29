import { plainToInstance, Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsString, Matches, Max, Min, validateSync } from 'class-validator';

export enum AppEnv {
  Development = 'development',
  Test = 'test',
  Ci = 'ci',
  Production = 'production',
}

export class EnvironmentVariables {
  @IsEnum(AppEnv)
  APP_ENV: AppEnv;

  // Explicit @Type instead of enableImplicitConversion: env values are strings, convert only PORT.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  @Matches(/^postgres(ql)?:\/\//, { message: 'DATABASE_URL must be a postgres:// URL' })
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  APP_VERSION: string = 'dev';
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config);
  const errors = validateSync(env, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join('; ')}`)
      .join('\n  ');
    throw new Error(`Invalid environment configuration:\n  ${details}`);
  }

  return env;
}
