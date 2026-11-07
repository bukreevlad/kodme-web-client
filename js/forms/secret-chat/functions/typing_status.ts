// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { throttle } from "../../../utils/helpers/throttle.js";
import { SecretChatsManager } from "../../../core/managers/secret_chats_manager.js";

// Импортируем типы
import type { ThrottledFunction } from "../../../utils/helpers/throttle.js";
import type { SecretChat } from "../index.js";

/** Допустимые действия статуса активности (контроль secret_frames). */
const ALLOWED_ACTIONS = new Set(["typing", "recording_audio", "recording_video", "uploading_document"]);

// Интервал троттлинга: «печатает…» у собеседника имеет смысл обновлять
// не чаще раза в 4 секунды — чаще слать бессмысленно
const TYPING_INTERVAL_MS = 4000;

/**
 * ***************************************************************************
 * TypingStatus - статус активности пользователя в секретном чате.
 *
 * Отвечает за отправку «печатает…» / «записывает голосовое» / «записывает
 * видео» / «отправляет файл» по DataChannel и не позволяет спамить этими
 * событиями (троттлинг через utils/helpers/throttle.js с `.cancel()`).
 * ***************************************************************************
 */
export class TypingStatus {

    /** Привязанная форма (null после destroy — статусы больше не шлём). */
    form: SecretChat | null;

    /** Интервал троттлинга в миллисекундах. */
    intervalMs: number;

    /** Троттлинг по действию: «печатает» не гасит «записывает голосовое». */
    throttledSend: Map<string, ThrottledFunction<[]>>;

    /**
     * ***************************************************************************
     * @param form - Экземпляр формы, к которой привязан статус.
     * @param options - Опции (интервал троттлинга).
     * ***************************************************************************
     */
    constructor(form: SecretChat, options: { intervalMs?: number } = {}) {

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
     * Отправить статус активности собеседнику (с троттлингом).
     * @param data - Данные статуса (action: typing/recording_audio/recording_video/uploading_document).
     * @returns void
     * ***************************************************************************
     */
    send(data: { action?: string } = {}): void {

        // Формы уже нет (чат закрыт) — отправлять некуда
        if (!this.form?.chatId) return;

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
        const form = this.form;
        if (!form?.chatId) return;

        // Менеджер обязан быть инициализирован (создаётся вместе с home)
        const manager = SecretChatsManager.instance;
        if (!manager) return;

        // invariant: ALLOWED_ACTIONS отсекает всё, кроме статусов control-кадра typing
        const status = action as "typing" | "recording_audio" | "recording_video" | "uploading_document";

        // Запрос не ждём: отметка активности не критична, а без соединения
        // менеджер бросит ошибку — не превращаем её в необработанный промис
        manager.sendTyping(form.chatId, status).catch(error => {
            Logger.debug(`[app][secret-chat][typing-status]: не удалось отправить «${action}».`, error?.message);
        });

        Logger.debug(`[app][secret-chat][typing-status]: отправлен экшен «${action}».`);

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
