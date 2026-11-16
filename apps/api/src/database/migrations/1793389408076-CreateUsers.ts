import type { MigrationInterface, QueryRunner } from 'typeorm';

// Hand-written: migration:generate can't produce the functional lower(email) index.
export class CreateUsers1793389408076 implements MigrationInterface {
  name = 'CreateUsers1793389408076';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "user_role" AS ENUM ('admin', 'user')`);

    // gen_random_uuid() is built into Postgres >= 13, no extension needed.
    // DB-level defaults also apply to rows inserted via raw SQL (seeds, tests).
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"            uuid         NOT NULL DEFAULT gen_random_uuid(),
        "email"         varchar(320) NOT NULL,
        "password_hash" text         NOT NULL,
        "role"          "user_role"  NOT NULL DEFAULT 'user',
        "created_at"    timestamptz  NOT NULL DEFAULT now(),
        "updated_at"    timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);

    // Case-insensitive uniqueness: 'A@x.com' and 'a@x.com' conflict (23505).
    // Also serves WHERE lower(email) = lower($1) lookups and ON CONFLICT ((lower(email))).
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_email_lower" ON "users" (lower("email"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse order; dropping the type keeps run -> revert -> run working.
    await queryRunner.query(`DROP INDEX "UQ_users_email_lower"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "user_role"`);
  }
}
