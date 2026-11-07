// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { throttle } from "../../../utils/helpers/throttle.js";

// Импортируем requests
import { typingStatusRequest } from "../requests/typing_status.js";

// Импортируем типы
import type { ThrottledFunction } from "../../../utils/helpers/throttle.js";
import type { Messages } from "../index.js";

// Допустимые действия статуса активности
const ALLOWED_ACTIONS = new Set(["typing", "recording_audio", "uploading_document"]);

// Интервал троттлинга: сервер всё равно показывает «печатает…» не чаще раза
// в 4 секунды, поэтому чаще слать бессмысленно — только выжигаем лимит запросов
const TYPING_INTERVAL_MS = 4000;

/**
 * ***************************************************************************
 * TypingStatus - статус активности пользователя в чате.
 *
 * Отвечает за отправку «печатает…» / «записывает голосовое» / «загружает файл»
 * и не позволяет спамить этими событиями.
 *
 * Раньше троттлинг был написан вручную внутри `send()` сравнением `Date.now()`.
 * Проблема была не в логике, а в том, что ручная проверка не отменялась:
 * при закрытии чата последний статус всё равно улетел бы на сервер, а дефолт
 * прийти `undefined` (дефолт `send(data = { action = "typing" } = {})` —
 * синтаксически валидно, но при `send({})` даёт `undefined` вместо «typing»).
 * Теперь троттлинг — отдельный примитив `utils/helpers/throttle.js` с
 * `.cancel()`, а дефолты разбираются явно.
 * ***************************************************************************
 */
export class TypingStatus {

    /** Привязанная форма (null после destroy — статусы больше не шлём). */
    form: Messages | null;

    /** Интервал троттлинга в миллисекундах. */
    intervalMs: number;

    /** Троттлинг по действию: «печатает» не гасит «записывает голосовое». */
    throttledSend: Map<string, ThrottledFunction<[]>>;

    /**
     * ***************************************************************************
     * @param form - Экземпляр формы (например, Messages), к которой привязан статус.
     * @param options - Опции (интервал троттлинга).
     * ***************************************************************************
     */
    constructor(form: Messages, options: { intervalMs?: number } = {}) {

        // Проверяем форму
        if (!form) {
            throw new Error("TypingStatus: Не передан экземпляр формы");
        }

        // Устанавливаем параметры
        this.form = form;
        this.intervalMs = options.intervalMs ?? TYPING_INTERVAL_MS;

        // Троттлинг по последнему аргументу (действию): статусы разные,
        // поэтому «печатает» не должен гасить отправку «записывает голосовое»
        this.throttledSend = new Map();

    }

    /**
     * ***************************************************************************
     * Отправить статус активности на сервер (с троттлингом).
     * @param data - Данные статуса (action: typing/recording_audio/uploading_document).
     * @returns void
     * ***************************************************************************
     */
    send(data: { action?: string } = {}): void {

        // Формы уже нет (чат закрыт) — отправлять некуда
        if (!this.form?.channelId) return;

        // Явный дефолт: `send({})` обязан означать «печатает», а не `undefined`
        const requested = data?.action;
        const action = (requested && ALLOWED_ACTIONS.has(requested)) ? requested : "typing";

        // Для каждого действия — свой троттлинг
        let throttled = this.throttledSend.get(action);

        // Создаём обёртку при первом обращении к действию
        if (!throttled) {

            throttled = throttle(() => this._sendAction(action), this.intervalMs);

            // Имя действия попадает в контекст лога и в payload
            this.throttledSend.set(action, throttled);

        }

        throttled();

    }

    /**
     * ***************************************************************************
     * Приватный метод: непосредственная отправка одного статуса.
     * @param action - Действие статуса.
     * @returns void
     * ***************************************************************************
     */
    _sendAction(action: string): void {

        // Пока отправляли, чат могли закрыть
        if (!this.form?.channelId) return;

        // Устанавливаем данные
        let payload = {
            channel_id: this.form.channelId,
            action: action
        }

        // Запрос не ждём: отметка активности не критична, а ошибка не должна
        // превращаться в необработанный промис
        typingStatusRequest(payload).catch(error => {
            Logger.debug(`[app][messages][typing-status]: не удалось отправить «${action}».`, error?.message);
        });

        Logger.debug(`[app][messages][typing-status]: отправлен экшен «${action}».`);

    }

    /**
     * ***************************************************************************
     * Очистка данных: отменяем отложенные статусы и отвязываем форму.
     * @returns void
     * ***************************************************************************
     */
    destroy(): void {

        // Гасим отложенные отправки: после закрытия чата статус «печатает»
        // не должен появляться у собеседника
        for (const throttled of this.throttledSend.values()) {
            throttled.cancel();
        }

        this.throttledSend.clear();
        this.form = null;

    }

}
