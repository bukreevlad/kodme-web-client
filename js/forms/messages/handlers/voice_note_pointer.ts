// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { GestureController } from "../../../utils/gesture_controller.js";

// Импортируем functions
import { VoiceNoteSession } from "../functions/voice_note_session.js";

// Импортируем типы
import type { Messages } from "../index.js";

/**
 * ***************************************************************************
 * Подписка на жесты записи голосового сообщения (кнопка микрофона в футере).
 *
 * Тап — «закреплённая» запись: появляется панель с отменой, паузой и отправкой.
 * Удержание — запись, пока держишь палец; отпускание отправляет,
 * свайп вверх (более 80px) отменяет запись.
 *
 * @param form - Экземпляр формы.
 * @param element - Кнопка микрофона.
 * ***************************************************************************
 */
export function voiceNotePointerHandler(form: Messages, element: HTMLElement): void {

    try {

        // Повторная инициализация не должна создавать второй контроллер.
        if (!form || !element || form.voiceNoteGestureController) return;

        let holdStarted = false;
        let cancelIntent = false;
        let startPromise: Promise<boolean> | null = null;

        /**
         * Получает или создаёт сессию голосовой записи.
         * @returns Сессия голосовой записи.
         */
        const getSession = (): VoiceNoteSession => {
            if (!form.voiceNoteSession) {
                form.voiceNoteSession = new VoiceNoteSession(form);
            }
            return form.voiceNoteSession;
        };

        /**
         * Выполняет асинхронное действие и логирует его ошибку.
         * @param action - Асинхронное действие.
         */
        const execute = async (action: () => Promise<void>): Promise<void> => {
            try {
                await action();
            } catch (error) {
                Logger.error(error);
            }
        };

        /**
         * Отменяет текущую запись и дожидается запуска рекордера, если он ещё выполняется.
         */
        const cancel = async (): Promise<void> => {
            const session = form.voiceNoteSession;
            const promise = startPromise;
            const shouldCancel = holdStarted || form.voiceRecorder || session?.isStarting || session?.isStopping;

            holdStarted = false;
            startPromise = null;

            if (promise) await promise;

            if (shouldCancel || form.voiceRecorder) {
                await session?.cancel();
            }

            cancelIntent = false;
        };

        // Используем общий контроллер жестов для мыши и сенсорного экрана.
        form.voiceNoteGestureController = new GestureController(element, {
            // Кнопка сама является интерактивным элементом, но её жесты
            // должны обрабатываться даже после получения фокуса.
            ignoreInteractive: false,
            stopPropagation: true,
            threshold: 8,
            tap: {
                // Короткое нажатие запускает закреплённую запись, а удержание —
                // запись до отпускания кнопки.
                timeout: 300,
                longTapTimeout: 250,
                onTap: (event) => execute(async () => {
                    if (event.cancelable) event.preventDefault();

                    // Повторный тап по активному микрофону отменяет запись.
                    if (form.voiceRecorder || form.voiceNoteSession?.isStarting || form.voiceNoteSession?.isStopping) {
                        await cancel();
                        return;
                    }

                    holdStarted = false;
                    cancelIntent = false;
                    startPromise = getSession().start({ hold: false });
                    await startPromise;
                    startPromise = null;
                }),
                onLongTap: (event) => execute(async () => {
                    if (event.cancelable) event.preventDefault();

                    // Если запись уже идёт или ещё запускается, долгий тап
                    // также является отменой.
                    if (form.voiceRecorder || form.voiceNoteSession?.isStarting || form.voiceNoteSession?.isStopping) {
                        cancelIntent = true;
                        await cancel();
                        return;
                    }

                    holdStarted = true;
                    cancelIntent = false;
                    startPromise = getSession().start({ hold: true });
                    await startPromise;
                }),
                onLongTapEnd: () => execute(async () => {
                    if (!holdStarted) return;

                    const session = form.voiceNoteSession;
                    const promise = startPromise;

                    // Снимаем флаг до await, чтобы отмена или свайп не запустили
                    // второй обработчик отпускания для того же жеста.
                    holdStarted = false;
                    startPromise = null;

                    if (promise) await promise;

                    // Пока ожидал запуск, запись могла быть отменена
                    // другим жестом или закрытием формы.
                    if (!form.voiceRecorder) {
                        cancelIntent = false;
                        return;
                    }

                    const elapsed = session?.recorder?.elapsedMs || 0;
                    const shouldCancel = cancelIntent || elapsed <= 1000;

                    cancelIntent = false;

                    if (shouldCancel) {
                        await session?.cancel();
                    } else {
                        await session?.stop();
                    }
                })
            },
            swipe: {
                directions: ["up"],
                commitDistance: 80,
                onCommit: () => execute(async () => {
                    const session = form.voiceNoteSession;
                    const isStarting = session?.isStarting;
                    const isStopping = session?.isStopping;

                    // Свайп отменяет и уже начатую запись, и запущенную
                    // асинхронно операцию, если палец двинулся до её завершения.
                    if (!holdStarted && !form.voiceRecorder && !isStarting && !isStopping) return;

                    cancelIntent = true;
                    session?.setSlidingCancel(true);

                    // Для pending start/stop отменяем сразу, не дожидаясь
                    // появления панели записи.
                    if (isStarting || isStopping) {
                        await cancel();
                    }
                }),
                onCancel: () => { },
                onEnd: () => {
                    // Для закреплённой записи свайп обрабатывается здесь,
                    // а удержание завершает свой жест в onLongTapEnd.
                    // Проверяем именно intent: после commit пользователь мог
                    // вернуть палец ближе к кнопке до отпускания.
                    if (cancelIntent && !holdStarted) {
                        execute(cancel);
                    }
                }
            },
            onCancel: () => execute(async () => {
                cancelIntent = true;
                await cancel();
            }),
            onContextMenu: (event) => event.preventDefault()
        });

    } catch (error) {
        Logger.error(error);
    }

}
