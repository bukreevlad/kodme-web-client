// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем forms
import { Search } from "../../search/index.js";

// Импортируем requests
import { addParticipantRequest } from "../requests/add_participant.js";

// Импортируем типы
import type { SearchRecord } from "../../search/types.js";
import type { Call } from "../index.js";

/**
 * ***************************************************************************
 * Приглашает ещё одного участника в идущий звонок.
 *
 * Выбор человека — штатная форма поиска с типом «пользователи» и callback:
 * диалог-список здесь пришлось бы строить заново, а Search уже умеет и
 * поиск, и рекомендации, и профиль. Приглашённый увидит входящий звонок
 * и вольётся в комнату по кнопке «Принять».
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function addParticipantHandler(form: Call): void {

    try {

        // Без зарегистрированного звонка приглашать некуда
        if (!form?.callId) return;

        // Открываем форму поиска
        new Search({
            allowSearchType: ["users"],
            searchType: "users",
            callback: async (data) => {

                // Выбор сделан — форма поиска больше не нужна. Сама она при
                // callback не закрывается (в отличие от обычного клика, где
                // открывается профиль) и осталась бы висеть поверх звонка
                Search.instance?.modal?.close();

                // Отправляем приглашение
                await invite(form, data);

            },
            options: {
                insertInto: form.modal?.content,
            }
        });

    } catch (error) {
        Logger.error("[app][call]: Не удалось открыть выбор участника", error);
    }

}

/**
 * ***************************************************************************
 * Отправляет приглашение выбранному пользователю и показывает результат.
 * @param form - Экземпляр формы.
 * @param user - Выбранный пользователь (из формы поиска).
 * @returns Промис отправки приглашения.
 * ***************************************************************************
 */
async function invite(form: Call, user: SearchRecord): Promise<void> {

    try {

        // Себя приглашать нельзя
        if (!user?.id || user.id === form.userId) return;

        // Уже в комнате — говорим об этом сразу, не тратя запрос на сервер
        if (form.store?.get(user.id)) {
            Toast.warning(window._lc.forms.call.toasts.already_in_call, { position: "top-right" });
            return;
        }

        // Запрос на сервер
        await addParticipantRequest({
            call_id: form.callId,
            user_id: user.id
        });

        // Toast
        Toast.success(window._lc.forms.call.toasts.invited);

    } catch (error) {

        Logger.error("🚨 [app][call]: Ошибка приглашения участника:", error);

        // Флаг, что тост уже показан
        let isToastShown = false;
        let message = getErrorMessage(error);

        // ---------- ЗВОНОК ----------
        // Звонок уже завершён или я в нём больше не числится —
        // приглашать больше некого
        if (message.includes("CALL_NOT_ACTIVE") || message.includes("NOT_A_MEMBER")) {
            Toast.error(window._lc.forms.call.toasts.call_not_active, { position: "top-right" });
            isToastShown = true;
        }

        // Пригласить себя нельзя
        if (message.includes("IDS_CANNOT_MATCH")) {
            Toast.error(window._lc.forms.call.toasts.invite_self, { position: "top-right" });
            isToastShown = true;
        }

        // Уже числится в звонке: приглашён ранее и ещё не вышел
        if (message.includes("ALREADY_PARTICIPANT")) {
            Toast.warning(window._lc.forms.call.toasts.already_in_call, { position: "top-right" });
            isToastShown = true;
        }

        // Звонок запрещён настройками приватности
        if (message.includes("ACCESS_DENIED")) {
            Toast.error(window._lc.forms.call.toasts.calls_restricted, { position: "top-right" });
            isToastShown = true;
        }
        // ---------- ЗВОНОК ----------

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(window._lc.forms.call.toasts.invite_error, { position: "top-right" });
        }

    }

}
