/**
 * ***************************************************************************
 * WEB-AUTHN УТИЛИТЫ - клиентские помощники для ключей доступа (Passkey).
 * ***************************************************************************
 */

/**
 * ***************************************************************************
 * Проверка поддержки WebAuthn браузером/обёрткой (PWA, десктоп).
 * @returns {boolean} - true, если API ключей доступа доступно.
 * ***************************************************************************
 */
export function isWebauthnSupported(): boolean {

    // PublicKeyCredential — индикатор наличия WebAuthn-поддержки
    return typeof window !== "undefined" && "PublicKeyCredential" in window;

}

/**
 * ***************************************************************************
 * Декодирование base64url в байты (base64url → Uint8Array).
 * Сервер отдаёт challenge/идентификаторы в base64url, а WebAuthn-API
 * браузера принимает BufferSource — конвертация обязательна.
 * @param {string} value - Строка base64url.
 * @returns {Uint8Array<ArrayBuffer>} - Декодированные байты (база — ArrayBuffer,
 *          как требует BufferSource WebAuthn-API).
 * ***************************************************************************
 */
export function base64urlToBuffer(value: string): Uint8Array<ArrayBuffer> {

    // Приводим формат к standard base64 (символы + / и паддинг =)
    let base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) base64 += "=";

    // Декодируем строку в байты
    let binary = atob(base64);
    let bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    // Возвращаем байты
    return bytes;

}

/**
 * Опции создания credential'а в JSON-формате (как их отдаёт сервер).
 */
export interface WebauthnCreationOptionsJson {

    /** Данные RP. */
    rp: { id: string; name: string };

    /** Данные пользователя (идентификатор в base64url). */
    user: { id: string; name: string; displayName: string };

    /** Challenge в base64url. */
    challenge: string;

    /** Разрешённые алгоритмы ключа. */
    pubKeyCredParams: { type: string; alg: number }[];

    /** Таймаут ceremony (мс). */
    timeout: number;

    /** Уже зарегистрированные ключи (исключаются из создания). */
    excludeCredentials?: { type: string; id: string; transports?: string[] }[];

    /** Требования к аутентификатору. */
    authenticatorSelection?: { residentKey: string; userVerification: string };

    /** Уровень attestation. */
    attestation?: string;

}

/**
 * Опции получения assertion в JSON-формате (как их отдаёт сервер).
 */
export interface WebauthnRequestOptionsJson {

    /** Идентификатор RP. */
    rpId: string;

    /** Challenge в base64url. */
    challenge: string;

    /** Таймаут ceremony (мс). */
    timeout: number;

    /** Требование верификации пользователя. */
    userVerification: string;

    /** Разрешённые ключи (пусто — discoverable-вход). */
    allowCredentials?: { type: string; id: string; transports?: string[] }[];

}

/**
 * ***************************************************************************
 * Конвертация JSON-опций сервера в PublicKeyCredentialCreationOptions.
 * Идентификаторы и challenge конвертируются из base64url в байты —
 * WebAuthn-API браузера принимает только BufferSource.
 * @param {WebauthnCreationOptionsJson} options - Опции от сервера.
 * @returns {PublicKeyCredentialCreationOptions} - Опции для navigator.credentials.create.
 * ***************************************************************************
 */
export function toCreationOptions(options: WebauthnCreationOptionsJson): PublicKeyCredentialCreationOptions {

    return {
        rp: options.rp,
        user: {
            id: base64urlToBuffer(options.user.id),
            name: options.user.name,
            displayName: options.user.displayName
        },
        challenge: base64urlToBuffer(options.challenge),
        // invariant: сервер отдаёт тип public-key в pubKeyCredParams
        pubKeyCredParams: options.pubKeyCredParams.map((item) => ({
            type: "public-key" as PublicKeyCredentialType,
            alg: item.alg
        })),
        timeout: options.timeout,
        excludeCredentials: (options.excludeCredentials ?? []).map((item) => ({
            id: base64urlToBuffer(item.id),
            // invariant: сервер отдаёт тип public-key
            type: "public-key" as PublicKeyCredentialType,
            ...(item.transports ? { transports: item.transports as AuthenticatorTransport[] } : {})
        })),
        // invariant: сервер отдаёт допустимые значения requirement'ов
        ...(options.authenticatorSelection ? { authenticatorSelection: options.authenticatorSelection as AuthenticatorSelectionCriteria } : {}),
        ...(options.attestation ? { attestation: options.attestation as AttestationConveyancePreference } : {})
    };

}

/**
 * ***************************************************************************
 * Конвертация JSON-опций сервера в PublicKeyCredentialRequestOptions.
 * Challenge и идентификаторы конвертируются из base64url в байты.
 * @param {WebauthnRequestOptionsJson} options - Опции от сервера.
 * @returns {PublicKeyCredentialRequestOptions} - Опции для navigator.credentials.get.
 * ***************************************************************************
 */
export function toRequestOptions(options: WebauthnRequestOptionsJson): PublicKeyCredentialRequestOptions {

    return {
        rpId: options.rpId,
        challenge: base64urlToBuffer(options.challenge),
        timeout: options.timeout,
        // invariant: сервер отдаёт допустимое значение userVerification
        userVerification: options.userVerification as UserVerificationRequirement,
        allowCredentials: (options.allowCredentials ?? []).map((item) => ({
            id: base64urlToBuffer(item.id),
            // invariant: сервер отдаёт тип public-key
            type: "public-key" as PublicKeyCredentialType,
            ...(item.transports ? { transports: item.transports as AuthenticatorTransport[] } : {})
        }))
    };

}

/**
 * ***************************************************************************
 * Кодирование байтов в base64url (Uint8Array → base64url).
 * Ответ аутентификатора (clientDataJSON, authenticatorData, signature)
 * клиент передаёт серверу именно в этом формате.
 * @param {ArrayBuffer | Uint8Array} value - Байты.
 * @returns {string} - Строка base64url без паддинга.
 * ***************************************************************************
 */
export function bufferToBase64url(value: ArrayBuffer | Uint8Array): string {

    // Приводим к Uint8Array (ArrayBuffer приходит из ответа аутентификатора)
    let bytes = value instanceof Uint8Array ? value : new Uint8Array(value);

    // Кодируем байты в binary-строку, затем в base64
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    // Возвращаем base64url без паддинга
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

}
