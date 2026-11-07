// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { PlatformBridge } from "../../../utils/platform.bridge.js";
import { getErrorMessage, getErrorStatus } from "../../../utils/helpers/error_util.js";
import { isWebauthnSupported, toCreationOptions, bufferToBase64url } from "../../../utils/helpers/webauthn.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { passkeyRegisterBeginRequest } from "../requests/passkey_register_begin.js";
import { passkeyRegisterFinishRequest } from "../requests/passkey_register_finish.js";

// Импортируем functions
import { getPasskeys } from "../functions/get_passkeys.js";

// Импортируем типы
import type { UserSettingSecurity } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Регистрация нового ключа доступа: challenge → диалог браузера →
 * проверка ответа аутентификатора и сохранение credential'а.
 * @param form - Форма безопасности.
 * ***************************************************************************
 */
export async function addPasskeyHandler(form: UserSettingSecurity): Promise<void> {

    try {

        // Если WebAuthn недоступен (старый браузер/обёртка)
        if (!isWebauthnSupported()) {
            Toast.error(t("forms.user_setting_security.toasts.passkey_not_supported"));
            return;
        }

        // Шаг 1: одноразовый challenge и опции создания
        const begin = await passkeyRegisterBeginRequest();

        // Проверка запроса
        if (!begin.status) return;

        // Шаг 2: диалог браузера — верификация и создание credential'а
        const credential = await navigator.credentials.create({
            publicKey: toCreationOptions(begin.data.options)
        }) as PublicKeyCredential | null;

        // Пользователь закрыл диалог аутентификатора — выходим молча
        if (!credential?.response) return;

        // Ответ аутентификатора (типизируем через узкий каст: это attestation)
        const response = credential.response as AuthenticatorAttestationResponse;

        // Перевозки аутентификатора (internal/hybrid) — для будущих входов
        const transports = typeof response.getTransports === "function"
            ? response.getTransports()
            : undefined;

        // Шаг 3: проверка ответа и сохранение ключа (имя — платформа по умолчанию)
        await passkeyRegisterFinishRequest({
            ceremony_id: begin.data.ceremony_id,
            client_data: bufferToBase64url(response.clientDataJSON),
            attestation_object: bufferToBase64url(response.attestationObject),
            transports: transports,
            name: PlatformBridge.platform || undefined
        });

        // Toast: ключ добавлен
        Toast.success(t("forms.user_setting_security.toasts.passkey_added"));

        // Обновляем список ключей
        await getPasskeys(form);

    } catch (error) {

        // Отмена пользователем диалога аутентификатора — не ошибка
        if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "AbortError")) return;

        Logger.error(error);

        // Флаг: показан ли уже конкретный тост ошибки
        let isToastShown = false;

        // Если достигнут лимит ключей
        if (getErrorMessage(error).includes("LIMIT_REACHED")) {
            Toast.error(t("forms.user_setting_security.toasts.passkey_limit"));
            isToastShown = true;
        }

        // Если такой ключ уже зарегистрирован
        if (getErrorMessage(error).includes("DUPLICATE")) {
            Toast.error(t("forms.user_setting_security.toasts.passkey_duplicate"));
            isToastShown = true;
        }

        // Если ceremony истекла или неверна
        if (getErrorMessage(error).includes("CEREMONY_")) {
            Toast.error(t("forms.user_setting_security.toasts.passkey_ceremony_expired"));
            isToastShown = true;
        }

        // Если ответ аутентификатора не прошёл проверку
        if (getErrorMessage(error).includes("RESPONSE_INVALID")) {
            Toast.error(t("forms.user_setting_security.toasts.passkey_invalid"));
            isToastShown = true;
        }

        // Если превышен лимит запросов
        if (getErrorMessage(error).includes("RATE_LIMIT_EXCEEDED") || getErrorStatus(error) === 429) {
            Toast.warning(t("forms.user_setting_security.toasts.too_many_requests"));
            isToastShown = true;
        }

        // Если ошибка не распознана — показываем общую
        if (!isToastShown) {
            Toast.error(t("api.errors.server_error"));
        }

    }

}
