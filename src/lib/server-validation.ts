import { z } from "zod";

/**
 * Esquemas estritos de validação do lado do servidor (Server-Side Validation)
 * Com rejeição explícita de campos extras (.strict()) para prevenir Mass Assignment
 */

// 1. Ação create_loja
export const CreateLojaSchema = z.object({
  action: z.literal("create_loja"),
  loja_name: z.string().trim().min(2, "Nome da loja deve ter no mínimo 2 caracteres").max(100, "Nome da loja excede 100 caracteres"),
  loja_phone: z.string().trim().max(20, "Telefone excede 20 caracteres").optional().nullable(),
  loja_cnpj: z.string().trim().max(20, "CNPJ/CPF excede 20 caracteres").optional().nullable(),
  owner_name: z.string().trim().min(2, "Nome do proprietário deve ter no mínimo 2 caracteres").max(100, "Nome excede 100 caracteres"),
  owner_email: z.string().trim().email("Formato de e-mail inválido").max(255, "E-mail excede 255 caracteres"),
  owner_password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres").max(72, "Senha excede limite de segurança").optional(),
}).strict(); // Rejeita qualquer campo extra como role: 'admin', isAdmin, etc.

// 2. Ação create_master
export const CreateMasterSchema = z.object({
  action: z.literal("create_master"),
  full_name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72).optional(),
  phone: z.string().trim().max(20).optional().nullable(),
}).strict();

// 3. Ação create_vendedora
export const CreateVendedoraSchema = z.object({
  action: z.literal("create_vendedora"),
  full_name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  loja_id: z.string().uuid("loja_id deve ser um UUID válido"),
  password: z.string().min(8).max(72).optional(),
  phone: z.string().trim().max(20).optional().nullable(),
}).strict();

// 4. Ação reset_password
export const ResetPasswordSchema = z.object({
  action: z.literal("reset_password"),
  user_email: z.string().trim().email().max(255),
  new_password: z.string().min(8, "Nova senha deve ter no mínimo 8 caracteres").max(72),
}).strict();

// 5. Ação delete_user
export const DeleteUserSchema = z.object({
  action: z.literal("delete_user"),
  user_id: z.string().uuid("user_id deve ser um UUID válido"),
}).strict();

// 6. Envio de E-mail (send-email)
export const SendEmailSchema = z.object({
  to: z.string().trim().email("Destinatário deve ser um e-mail válido").max(255),
  subject: z.string().trim().min(1, "Assunto é obrigatório").max(200, "Assunto muito longo"),
  html: z.string().trim().min(1, "Corpo do e-mail é obrigatório").max(50000, "Corpo do e-mail excede tamanho máximo"),
  from: z.string().trim().max(100).optional(),
}).strict();

// 7. Checkout Session (create-checkout-session)
export const CreateCheckoutSessionSchema = z.object({
  malinha_id: z.string().uuid("malinha_id deve ser um UUID válido"),
}).strict();

// 8. Upload de Fotos de Produtos (Regras de Arquivo)
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

export function validateUploadFile(file: { name: string; size: number; type: string }) {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Arquivo excede o limite máximo permitido de ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`);
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error(`Tipo de arquivo não permitido: ${file.type}. Tipos aceitos: ${ALLOWED_MIME_TYPES.join(", ")}`);
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`Extensão de arquivo inválida: .${ext}. Extensões aceitas: ${ALLOWED_EXTENSIONS.join(", ")}`);
  }

  return true;
}
