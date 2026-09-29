/**
 * Módulo de Tratamento de Erros, Sanitização de Respostas e Auditoria de Logs
 * Garante que exceções internas não vazem SQL, stack traces, caminhos ou credenciais para o cliente,
 * mantém códigos HTTP semânticos (400, 401, 403, 404, 500) e correlaciona eventos via X-Request-Id.
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly clientMessage: string;
  public readonly details?: any;

  constructor(message: string, statusCode = 500, clientMessage?: string, details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = true;
    this.clientMessage = clientMessage || (statusCode >= 500 ? "Ocorreu um erro interno no servidor." : message);
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Requisição inválida.", details?: any) {
    super(message, 400, message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Credenciais inválidas ou sessão expirada.") {
    super(message, 401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Acesso negado: permissões insuficientes.") {
    super(message, 403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso não encontrado.") {
    super(message, 404, message);
  }
}

export class InternalServerError extends AppError {
  constructor(internalDebugMessage: string) {
    super(internalDebugMessage, 500, "Ocorreu um erro interno. Por favor, tente novamente mais tarde.");
  }
}

// Chaves sensíveis que devem ser mascaradas nos logs
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /senha/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /apikey/i,
  /api_key/i,
  /credit_?card/i,
  /cvv/i,
  /cpf/i,
];

/**
 * Sanitiza recursivamente objetos e strings para gravação segura em logs.
 * Remove senhas, tokens de autenticação, chaves de API e dados pessoais sensíveis.
 */
export function sanitizeLogData(data: any): any {
  if (data === null || data === undefined) return data;

  if (typeof data === "string") {
    // Mascara tokens Bearer no texto
    let sanitized = data.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED_TOKEN]");
    // Mascara senhas em URLs (ex: postgres://user:password@host)
    sanitized = sanitized.replace(/(:\/\/[^:]+:)([^@]+)(@)/g, "$1[REDACTED_PASSWORD]$3");
    return sanitized;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item));
  }

  if (typeof data === "object") {
    const cleanObj: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isSensitive) {
        if (/cpf/i.test(key) && typeof val === "string" && val.length >= 11) {
          cleanObj[key] = val.replace(/^(\d{3})\.?(\d{3})\.?(\d{3})-?(\d{2})$/, "***.***.$3-**");
        } else if (/token|auth/i.test(key)) {
          cleanObj[key] = "[REDACTED_TOKEN]";
        } else {
          cleanObj[key] = "[REDACTED]";
        }
      } else {
        cleanObj[key] = sanitizeLogData(val);
      }
    }
    return cleanObj;
  }

  return data;
}

export interface ErrorResponseOutput {
  status: number;
  headers: Record<string, string>;
  body: {
    error: string;
    message: string;
    requestId: string;
    details?: any;
  };
  internalLog: {
    requestId: string;
    timestamp: string;
    level: "ERROR" | "WARN";
    statusCode: number;
    rawMessage: string;
    stack?: string;
    sanitizedContext?: any;
  };
}

/**
 * Cria a resposta HTTP padronizada de erro e o log estruturado restrito correlacionado por requestId.
 */
export function formatErrorResponse(
  error: unknown,
  reqHeaders?: Headers | Record<string, string | undefined>,
  contextData?: any
): ErrorResponseOutput {
  const getHeader = (name: string): string | undefined => {
    if (!reqHeaders) return undefined;
    if (typeof (reqHeaders as any).get === "function") {
      return (reqHeaders as Headers).get(name) || undefined;
    }
    return (reqHeaders as Record<string, any>)[name] || (reqHeaders as Record<string, any>)[name.toLowerCase()];
  };

  // 1. Extração ou geração do Request ID
  const existingRequestId = getHeader("x-request-id");
  const requestId = existingRequestId || `req-${crypto.randomUUID()}`;

  let statusCode = 500;
  let clientMessage = "Ocorreu um erro interno. Por favor, tente novamente mais tarde.";
  let errorName = "InternalServerError";
  let details: any = undefined;
  const rawMessage = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  // 2. Mapeamento Semântico de Erros
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    clientMessage = error.clientMessage;
    errorName = error.name;
    details = error.details;
  } else if (rawMessage.includes("Missing authorization") || rawMessage.includes("Unauthorized")) {
    statusCode = 401;
    clientMessage = "Credenciais inválidas ou token de autenticação não fornecido.";
    errorName = "UnauthorizedError";
  } else if (rawMessage.includes("Forbidden") || rawMessage.includes("permission denied")) {
    statusCode = 403;
    clientMessage = "Acesso negado para o recurso solicitado.";
    errorName = "ForbiddenError";
  } else if (rawMessage.includes("not found") || rawMessage.includes("Not Found")) {
    statusCode = 404;
    clientMessage = "Recurso solicitado não foi encontrado.";
    errorName = "NotFoundError";
  } else if (rawMessage.includes("invalid") || rawMessage.includes("required") || rawMessage.includes("SyntaxError")) {
    statusCode = 400;
    clientMessage = "Dados da requisição inválidos ou malformados.";
    errorName = "BadRequestError";
  }

  // 3. Resposta Segura para o Cliente (NUNCA expõe stack, SQL ou caminhos de arquivos)
  const clientBody: ErrorResponseOutput["body"] = {
    error: errorName,
    message: clientMessage,
    requestId,
  };

  if (details && statusCode < 500) {
    clientBody.details = details;
  }

  const responseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Request-Id": requestId,
  };

  // 4. Log Estruturado Interno Restrito com Sanitização
  const internalLog: ErrorResponseOutput["internalLog"] = {
    requestId,
    timestamp: new Date().toISOString(),
    level: statusCode >= 500 ? "ERROR" : "WARN",
    statusCode,
    rawMessage,
    stack: statusCode >= 500 ? stack : undefined,
    sanitizedContext: sanitizeLogData(contextData),
  };

  return {
    status: statusCode,
    headers: responseHeaders,
    body: clientBody,
    internalLog,
  };
}
