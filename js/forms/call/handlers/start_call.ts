// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { setState } from "../functions/set_state.js";
import { startNoAnswerTimer } from "../functions/no_answer_timer.js";

// Импортируем requests
import { startCallRequest } from "../requests/start.js";

// Импортируем forms
// Значимый импорт: нужен доступ к реестру Call.instances. Цикл
// «index → handlers/start_call → index» безопасен: к моменту вызова
// обработчика класс уже объявлен (обращение к Call отложено на runtime)
import { Call } from "../index.js";

/**
 * ***************************************************************************
 * Регистрирует исходящий звонок на сервере и получает LiveKit-токен.
 *
 * Сервер либо создаёт новый звонок, либо вливает звонящего в уже активный
 * звонок собеседника (`is_merged`) — во втором случае прозвона не будет:
 * собеседник уже в комнате, форма сразу перейдёт в состояние active.
 * @param form - Экземпляр формы.
 * @returns false, если сервер отклонил запрос и открывать форму нельзя.
 * ***************************************************************************
 */
export async function startCallHandler(form: Call): Promise<boolean> {

    try {

        // Запрос на сервер
        const response = await startCallRequest({ user_id: form.userId });

        // ---------- ОТВЕТ ----------
        // Ответ сервера приходит обёрнутым: { data, status, timestamp }.
        // Распаковываем явно — иначе токен и id звонка не дойдут до формы
        form.callId = response?.data?.call_id || null;
        form.token = response?.data?.token || null;
        form.isMerged = Boolean(response?.data?.is_merged);

        // Форма дальше известна по id звонка: по нему же приходит
        // [call]: declined и по нему её находят другие обработчики.
        // Реестр живёт на классе; цикл не замыкается — импорт только тип
        if (form.callId && form.key !== form.callId) {
            Call.instances.delete(form.key);
            form.key = form.callId;
            Call.instances.set(form.key, form);
        }

        // ---------- ПРОЗВОН ----------
        // Вливание в активный звонок: ждать ответа некого, собеседник уже
        // в комнате. Обычный звонок — показываем «Звонок…» и запускаем
        // отсчёт «нет ответа»
        if (!form.isMerged) {
            setState(form, "ringing");
            startNoAnswerTimer(form);
        }
        // ---------- ПРОЗВОН ----------

        return true;

    } catch (error) {

        Logger.error("🚨 [app][call]: Ошибка старта звонка:", error);

        // Флаг, что тост уже показан
        let isToastShown = false;
        let message = getErrorMessage(error);

        // ---------- ДОСТУП ----------
        // Звонки запрещены настройками приватности
        if (message.includes("ACCESS_DENIED_CALLS_RESTRICTED")) {
            Toast.error(window._lc.forms.call.toasts.calls_restricted, { position: "top-center" });
            isToastShown = true;
        }

        // Собеседник не найден или скрыт от нас
        if (message.includes("ACCESS_DENIED_USER_NOT_FOUND")) {
            Toast.error(window._lc.forms.call.toasts.user_not_found, { position: "top-center" });
            isToastShown = true;
        }
        // ---------- ДОСТУП ----------

        // ---------- ЗАНЯТОСТЬ ----------
        // У звонящего уже идёт другой звонок (или звонок собеседника
        // ещё не принят — в него вливаться рано)
        if (message.includes("CALL_BUSY")) {
            Toast.error(window._lc.forms.call.toasts.busy, { position: "top-center" });
            isToastShown = true;
        }
        // ---------- ЗАНЯТОСТЬ ----------

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(window._lc.forms.call.toasts.start_error, { position: "top-center" });
        }

        return false;

    }

}
