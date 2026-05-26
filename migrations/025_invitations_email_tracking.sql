-- Agrega trazabilidad de envío y expiración a la tabla invitations
ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS email_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Las invitaciones existentes quedan como 'pending' y sin expiración (NULL = no expiran)
-- Las nuevas invitaciones tendrán expires_at = created_at + 30 días (seteado desde el código)
