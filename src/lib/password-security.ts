/**
 * Módulo de Criptografia, Hash e Segurança de Senhas
 * Utiliza Web Crypto API com PBKDF2 (SHA-256, 100.000 iterações) e Salts CSPRNG de 128 bits,
 * espelhando as garantias de algoritmos de derivação de chaves como bcrypt/Argon2.
 * Implementa comparação em tempo constante para mitigar ataques de temporização (Timing Attacks).
 */

export interface PasswordHashRecord {
  algorithm: string;
  iterations: number;
  saltHex: string;
  hashHex: string;
  formattedString: string; // formato standard: $pbkdf2$iterations$salt$hash
}

/**
 * Gera um salt criptograficamente seguro utilizando CSPRNG (16 bytes / 128 bits).
 */
export function generateSecureSalt(bytes = 16): Uint8Array {
  const salt = new Uint8Array(bytes);
  crypto.getRandomValues(salt);
  return salt;
}

/**
 * Converte Uint8Array para string hexadecimal.
 */
function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Converte string hexadecimal para Uint8Array.
 */
function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Deriva o hash de uma senha utilizando PBKDF2-HMAC-SHA256 com salt único e 100.000 iterações.
 */
export async function hashPassword(
  plainTextPassword: string,
  providedSalt?: Uint8Array,
  iterations = 100000
): Promise<PasswordHashRecord> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(plainTextPassword),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const salt = providedSalt || generateSecureSalt(16);

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations,
      hash: "SHA-256",
    },
    passwordKey,
    256 // 256 bits de saída
  );

  const saltHex = bufferToHex(salt);
  const hashHex = bufferToHex(derivedBits);

  return {
    algorithm: "PBKDF2-HMAC-SHA256",
    iterations,
    saltHex,
    hashHex,
    formattedString: `$pbkdf2-sha256$i=${iterations}$s=${saltHex}$h=${hashHex}`,
  };
}

/**
 * Comparação em tempo constante (Constant-Time String/Buffer Compare)
 * Impede que atacantes descubram o hash medindo micro-diferenças no tempo de resposta.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
}

/**
 * Verifica se a senha informada corresponde ao registro de hash armazenado.
 */
export async function verifyPassword(
  plainTextPassword: string,
  storedRecord: PasswordHashRecord
): Promise<boolean> {
  const salt = hexToBuffer(storedRecord.saltHex);
  const computed = await hashPassword(plainTextPassword, salt, storedRecord.iterations);

  return constantTimeCompare(computed.hashHex, storedRecord.hashHex);
}
