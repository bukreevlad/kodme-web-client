// Импортируем utils
import { LocalStorage } from "../../../utils/local_storage.js";

// Импортируем типы
import type { BroadcastPlay } from "../index.js";

/**
 * ***************************************************************************
 * GLOBAL_EVENTS - глобальная координация медиа для трансляции.
 *
 * При включении аудио или другого видео приглушаем/останавливаем текущую
 * трансляцию — если пользователь выбрал такое поведение в настройках.
 *
 * Ссылку на обработчик сохраняем в форме (`boundGlobalMediaHandler`), чтобы
 * снять подписку в `_onBeforeClose()`: иначе она живёт до перезагрузки
 * страницы и удерживает уже закрытую форму.
 *
 * @param form - Экземпляр формы BroadcastPlay.
 * ***************************************************************************
 */
export function globalEvents(form: BroadcastPlay): void {

    // Если подписка уже стоит — не дублируем её
    if (form.boundGlobalMediaHandler) {
        window.removeEventListener("[app][audio]::media-play", form.boundGlobalMediaHandler);
    }

    // Слушаем глобальные события
    form.boundGlobalMediaHandler = (e: Event) => {

        // invariant: detail.type — "audio" либо "video", а для видео
        // отправитель (плееры приложения) всегда кладёт id медиа
        const detail = (e as CustomEvent<{ type: string; id?: string }>).detail;

        // Паузим это видео, если:
        // 1. Включили аудио
        // 2. Включили другое видео (ID не совпадает с нашим)
        const isForeignMedia =
            detail.type === "audio" ||
            (detail.type === "video" && detail.id !== form.cast?.id);

        if (!isForeignMedia) return;

        // Плеер мог быть уже уничтожен (форма закрыта, событие в очереди)
        if (!form.player) return;

        const typeAction = LocalStorage.session?.settings.broadcasts.type_global_media_event;

        // Применяем выбранный пользователем тип реакции
        if (typeAction === "paused") {
            form.player.stop();
        } else if (typeAction === "muted") {
            form.player.volume = 0;
        }

    };

    window.addEventListener("[app][audio]::media-play", form.boundGlobalMediaHandler);

}
