/** Mails habilitados, de ALLOWED_EMAILS (separados por coma). */
export function allowedEmails(lista = process.env.ALLOWED_EMAILS ?? ""): Set<string> {
  return new Set(
    lista
      .split(/[,;\s]+/)
      .map((m) => m.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** true si el mail está en la lista. Con la lista vacía no entra nadie. */
export function isAllowedEmail(email: string | null | undefined, lista?: string): boolean {
  if (!email) return false;
  return allowedEmails(lista).has(email.trim().toLowerCase());
}
