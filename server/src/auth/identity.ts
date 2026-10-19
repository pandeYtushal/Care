type IdentityRow = Record<string, unknown>;

export function profileNameForRole(role: unknown, row: IdentityRow): string | null {
  if (role === 'DOCTOR') return typeof row.display_name === 'string' ? row.display_name : null;
  if (role === 'PATIENT') return typeof row.full_name === 'string' ? row.full_name : null;
  return null;
}

export function safeUser(row: IdentityRow) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    fullName: profileNameForRole(row.role, row),
  };
}
