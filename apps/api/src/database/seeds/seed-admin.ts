import { plainToInstance, Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength, validateSync } from 'class-validator';
import { UserRole } from '../../users/user.entity';
import { hashPassword } from '../../users/password';
import dataSource from '../data-source';

class SeedAdminEnv {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'ADMIN_EMAIL must be a valid email' })
  ADMIN_EMAIL: string;

  @IsString({ message: 'ADMIN_PASSWORD is required' })
  @MinLength(20, { message: 'ADMIN_PASSWORD must be at least 20 characters' })
  ADMIN_PASSWORD: string;
}

function readEnv(): SeedAdminEnv {
  const env = plainToInstance(SeedAdminEnv, {
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  });
  const errors = validateSync(env);
  if (errors.length > 0) {
    // Only constraint messages: never echo the submitted values.
    const details = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    throw new Error(`Invalid seed configuration:\n  ${details.join('\n  ')}`);
  }
  return env;
}

async function main(): Promise<void> {
  // Validate before touching the DB, so a bad config leaves no side effects.
  const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = readEnv();
  const passwordHash = await hashPassword(password);

  await dataSource.initialize();
  try {
    // The DB decides on conflicts (unique lower(email) index), so concurrent runs can't duplicate.
    // DO NOTHING: an existing admin keeps its current password.
    const inserted: unknown[] = await dataSource.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, $3)
       ON CONFLICT ((lower(email))) DO NOTHING
       RETURNING id`,
      [email, passwordHash, UserRole.Admin],
    );
    console.log(
      inserted.length > 0 ? `Admin ${email} created.` : `User ${email} already exists, skipped.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
