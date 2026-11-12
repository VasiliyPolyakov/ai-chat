import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  Admin = 'admin',
  User = 'user',
}

// The schema is owned by migrations; this entity must stay in sync with them.
@Entity({ name: 'users' })
// Functional unique index on lower(email) lives only in the migration (decorators can't express it).
// synchronize: false stops migration:generate from proposing to drop it.
@Index('UQ_users_email_lower', { synchronize: false })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Normalized by the app; case-insensitive uniqueness is enforced by the DB index above.
  @Column({ type: 'varchar', length: 320 })
  email: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash: string;

  // enumName pins the Postgres type name (otherwise TypeORM generates users_role_enum).
  @Column({ type: 'enum', enum: UserRole, enumName: 'user_role', default: UserRole.User })
  role: UserRole;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // Updated by TypeORM on repository save() only; a raw UPDATE won't touch it.
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
