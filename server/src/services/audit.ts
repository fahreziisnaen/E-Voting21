import type { AuditStatus } from '../generated/prisma/client.js';
import { prisma, type DbClient } from '../lib/prisma.js';

export const AUDIT = {
  LOGIN: 'auth.login',
  LOGOUT: 'auth.logout',
  VOTE_CAST: 'vote.cast',
  VOTE_REJECTED: 'vote.rejected',
  ELECTION_UPDATED: 'election.updated',
  HERO_PHOTO_UPDATED: 'election.hero_photo_updated',
  CANDIDATE_CREATED: 'candidate.created',
  CANDIDATE_UPDATED: 'candidate.updated',
  CANDIDATE_DELETED: 'candidate.deleted',
  CANDIDATE_PHOTO_UPDATED: 'candidate.photo_updated',
  CATEGORY_CREATED: 'category.created',
  CATEGORY_UPDATED: 'category.updated',
  CATEGORY_DELETED: 'category.deleted',
  CLASS_CREATED: 'class.created',
  CLASS_UPDATED: 'class.updated',
  CLASS_DELETED: 'class.deleted',
  STUDENT_CREATED: 'student.created',
  STUDENT_UPDATED: 'student.updated',
  STUDENT_DELETED: 'student.deleted',
  STUDENT_ACCESS_CODE_RESET: 'student.access_code_reset',
  STUDENTS_IMPORTED: 'student.imported',
  STUDENTS_BULK_UPDATED: 'student.bulk_updated',
  STUDENTS_BULK_DELETED: 'student.bulk_deleted',
  TEACHER_CREATED: 'teacher.created',
  TEACHER_UPDATED: 'teacher.updated',
  TEACHER_DELETED: 'teacher.deleted',
  TEACHER_ACCESS_CODE_RESET: 'teacher.access_code_reset',
  TEACHERS_IMPORTED: 'teacher.imported',
  TEACHERS_BULK_UPDATED: 'teacher.bulk_updated',
  TEACHERS_BULK_DELETED: 'teacher.bulk_deleted',
  RESULTS_EXPORTED: 'results.exported',
  RESULTS_PUBLISHED: 'results.published',
  RESULTS_UNPUBLISHED: 'results.unpublished',
  ADMIN_PASSWORD_CHANGED: 'admin.password_changed',
  BACKUP_CREATED: 'backup.created',
  BACKUP_RESTORED: 'backup.restored',
  FACTORY_RESET: 'system.factory_reset',
} as const;

export type AuditAction = (typeof AUDIT)[keyof typeof AUDIT];

export interface AuditEntry {
  action: AuditAction;
  status: AuditStatus;
  userId?: number | null;
  actor?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordAudit(entry: AuditEntry, db: DbClient = prisma): Promise<void> {
  await db.auditLog.create({
    data: {
      action: entry.action,
      status: entry.status,
      userId: entry.userId ?? null,
      actor: entry.actor?.slice(0, 64) ?? null,
      metadata: (entry.metadata ?? undefined) as object | undefined,
    },
  });
}
