// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { LocalStorage } from "../../../utils/local_storage.js";
import { PlatformBridge } from "../../../utils/platform.bridge.js";
import { getErrorMessage, getErrorStatus } from "../../../utils/helpers/error_util.js";
import { isWebauthnSupported, toRequestOptions, bufferToBase64url } from "../../../utils/helpers/webauthn.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем forms
import { Sessions } from "../../sessions/index.js";

// Импортируем requests
import { passkeyLoginBeginRequest } from "../requests/passkey_login_begin.js";
import { passkeyLoginFinishRequest } from "../requests/passkey_login_finish.js";

// Импортируем типы
import type { Login } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Авторизация по ключу доступа (Passkey / WebAuthn): challenge → assertion →
 * пара токенов. Вход завершается здесь же, без кода из почты.
 * @param form - Форма входа.
 * ***************************************************************************
 */
export async function loginWithPasskeyHandler(form: Login): Promise<void> {

    try {

        // Если WebAuthn недоступен (старый браузер/обёртка)
        if (!isWebauthnSupported()) {
            Toast.error(t("forms.login.toasts.passkey_unsupported"));
            return;
        }

        // Устанавливаем переменные
        const email = form.tpl?.querySelector<HTMLInputElement>(`[name="email"]`);
        const platform = PlatformBridge.platform;
        const userAgent = window.navigator.userAgent;

        // Шаг 1: одноразовый challenge (email — необязательная пре-проверка)
        const begin = await passkeyLoginBeginRequest({
            email: email?.value.trim().toLowerCase() || undefined
        });

        // Проверка запроса
        if (!begin.status) return;

        // Шаг 2: диалог браузера — выбор аутентификатора и верификация
        const credential = await navigator.credentials.get({
            publicKey: toRequestOptions(begin.data.options)
        }) as PublicKeyCredential | null;

        // Пользователь закрыл диалог аутентификатора — выходим молча
        if (!credential?.response) return;

        // Ответ аутентификатора (типизируем через узкий каст: это assertion)
        const response = credential.response as AuthenticatorAssertionResponse;

        // Шаг 3: проверка assertion на сервере и выдача пары токенов
        const finish = await passkeyLoginFinishRequest({
            ceremony_id: begin.data.ceremony_id,
            client_data: bufferToBase64url(response.clientDataJSON),
            authenticator_data: bufferToBase64url(response.authenticatorData),
            signature: bufferToBase64url(response.signature),
            credential_id: credential.id,
            platform: platform,
            user_agent: userAgent
        });

        // Проверка запроса
        if (finish.status) {

            // Закрываем форму входа
            form.modal?.close();

            // Сохраняем сессию (форма ответа — как у confirm). Email берём
            // из ответа сервера: при входе по discoverable-ключу поле ввода
            // почты могло быть пустым, а форма сессий показывает user.email
            LocalStorage.saveSession({
                user: {
                    avatar_host_url: finish.data.avatar_host_url,
                    display_name: finish.data.display_name,
                    email: finish.data.email ?? email?.value.trim().toLowerCase() ?? ""
                },
                session_id: finish.data.session_id,
                access_token: finish.data.pair_token.accessToken,
                refresh_token: finish.data.pair_token.refreshToken
            });

            // Toast успеха: вход по ключу доступа выполнен
            Toast.success(t("forms.login.toasts.success_passkey_login"));

            // Открываем форму Sessions (как после confirm)
            new Sessions();

        }

    } catch (error) {

        // Отмена пользователем диалога аутентификатора — не ошибка
        if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "AbortError")) return;

        Logger.error(error);

        // Флаг: показан ли уже конкретный тост ошибки
        let isToastShown = false;

        // Если для аккаунта нет зарегистрированных ключей
        if (getErrorMessage(error).includes("NO_CREDENTIALS")) {
            Toast.error(t("forms.login.toasts.passkey_no_credentials"));
            isToastShown = true;
        }

        // Если ceremony истекла или неверна
        if (getErrorMessage(error).includes("CEREMONY_INVALID")) {
            Toast.error(t("forms.login.toasts.passkey_expired"));
            isToastShown = true;
        }

        // Если credential не найден
        if (getErrorMessage(error).includes("CREDENTIAL_NOT_FOUND")) {
            Toast.error(t("forms.login.toasts.passkey_credential_not_found"));
            isToastShown = true;
        }

        // Если ответ аутентификатора не прошёл проверку
        if (getErrorMessage(error).includes("RESPONSE_INVALID")) {
            Toast.error(t("forms.login.toasts.passkey_invalid"));
            isToastShown = true;
        }

        // Если счётчик подписей указывает на клон аутентификатора
        if (getErrorMessage(error).includes("SIGN_COUNT_REJECTED")) {
            Toast.error(t("forms.login.toasts.passkey_sign_count"));
            isToastShown = true;
        }

        // Если аккаунт заблокирован
        if (getErrorMessage(error).includes("USER_BLOCKED")) {
            Toast.error(t("forms.login.toasts.user_blocked"));
            isToastShown = true;
        }

        // Если превышен лимит запросов
        if (getErrorMessage(error).includes("RATE_LIMIT_EXCEEDED") || getErrorStatus(error) === 429) {
            Toast.warning(t("forms.login.toasts.too_many_requests"));
            isToastShown = true;
        }

        // Если ошибка не распознана — показываем общую
        if (!isToastShown) {
            Toast.error(t("api.errors.server_error"));
        }

    }

}
