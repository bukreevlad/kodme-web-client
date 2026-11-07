// Импортируем справочник типов файлов
import { isKind } from "../../../config/file_types.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { IsMobile } from "../../../utils/helpers/is_mobile.js";
import { GestureController } from "../../../utils/gesture_controller.js";
import { readEventPoint } from "../../../utils/dom/read_event_point.js";

// Импортируем components
import { Buttons } from "../../../components/buttons.js";

// Импортируем handlers
import { audioContextMenuHandler } from "./handlers/audio_context_menu.js";

// Импортируем типы
import type { AudioPlayerCallback, AudioPlayerState, AudioPlayerTrack } from "../../../utils/audio/audio_player.js";
import { normalizeAttachments } from "./types.js";
import type { AttachParent, AttachmentData } from "./types.js";

/**
 * ***************************************************************************
 * createAudioNoteItem - строка голосового сообщения: осциллограмма
 * (wave_form), длительность, кнопка Play/Pause и перемотка по клику на волну.
 *
 * Синхронизируется с глобальным AudioPlayerManager через систему подписок.
 * Легаси-класс возвращал DOM-узел из конструктора, поэтому состояние
 * (плеер, плейлист) живёт в замыкании фабрики.
 * @param message - Родительское сообщение.
 * @param data - Данные вложения (id, metadata и т.д.).
 * @returns DOM-элемент вложения.
 * ***************************************************************************
 */
export function createAudioNoteItem(message: AttachParent, data: AttachmentData): HTMLElement {

    // Актуальные данные вложения: __update__ объединяет поля (легаси-семантика merge)
    let current = data;

    // Внутренние параметры
    let playlist: AudioPlayerTrack[] = [];
    let playButton: Buttons | null = null;

    // **************************************************************************
    // Шаблон элемента
    // **************************************************************************
    function template(): HTMLElement {
        const element = new DOMParser().parseFromString(`
            <div class="item audio-note flex flex-row items-center w-full gap-2 p-1 rounded-lg hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] cursor-pointer select-none">
                <button action-play></button>
                <div class="flex flex-col gap-0 justify-center overflow-hidden flex-1">
                    <div data-wave-form class="flex flex-row w-full items-center gap-[1px]" style="height: 30px;"></div>
                    <span data-duration class="text-muted text-xs mt-1">0:00</span>
                </div>
            </div>
        `, "text/html").querySelector<HTMLElement>(".item");

        // Своя разметка всегда содержит «.item» — без элемента элемент списка не создаётся
        if (!element) throw new Error("Не найден шаблон: .item");

        return element;
    }

    // **************************************************************************
    // Установка/Перерисовка данных
    // **************************************************************************
    function setup(data: AttachmentData): void {

        try {

            // Обновляем данные
            current = data;

            // Устанавливаем кнопку управления
            let playPlaceholder = element.querySelector("[action-play]");
            playButton = Buttons.circle({
                attributes: ["action-play"],
                icon: { name: "player-play", settings: { filled: true } },
                intent: "primary"
            });

            // Заменяем элемент кнопки
            playPlaceholder?.replaceWith(playButton.dom);

            // Отрисовка осциллограммы (wave_form)
            const wave_form = current.metadata?.wave_form;

            if (wave_form && Array.isArray(wave_form)) {
                // Очищаем старую волну, если это update
                if (waveForm) waveForm.innerHTML = "";

                wave_form.forEach(amplitude => {
                    let bar = document.createElement("div");
                    // Гарантируем минимальную высоту в 10%, чтобы тишина тоже была видна
                    const heightPercent = Math.max(amplitude * 100, 10);
                    bar.style.height = `${heightPercent}%`;
                    bar.className = "wave-bar flex-1 min-w-[.15rem] bg-[var(--color-brand)] dark:bg-[var(--color-brand)] rounded-full transition-opacity duration-100";
                    bar.style.opacity = "0.5"; // По умолчанию непроигранные бары полупрозрачные
                    waveForm?.appendChild(bar);
                });
            }

            // Установка длительности
            const originalDuration = current.metadata?.original?.duration || current.metadata?.duration;
            if (originalDuration && durationEl) {
                durationEl.textContent = formatTime(originalDuration);
            }

        } catch (error) {
            Logger.error("Setup Error:", error);
        }

    }

    // **************************************************************************
    // Обработчики событий
    // **************************************************************************
    function actions(): void {

        // GestureController
        new GestureController(element, {
            threshold: 5,
            tap: {
                onTap: (event) => {
                    // event.target — EventTarget: ближайший узел ищем только у Element
                    const target = event.target instanceof Element ? event.target : null;

                    // Проверяем, был ли клик по дорожке осциллограммы
                    const waveTarget = target?.closest("[data-wave-form]");

                    // Если кликнули по волне И этот трек сейчас активен в плеере — перематываем
                    if (waveTarget && window.audioPlayer?.audioData?.id === current.id) {
                        // Важно: координаты читаем по факту наличия полей —
                        // instanceof TouchEvent кидает ReferenceError в окружении
                        // без глобального TouchEvent
                        const clientX = readEventPoint(event)?.x;

                        if (waveForm && clientX !== undefined) {
                            const rect = waveForm.getBoundingClientRect();
                            const x = clientX - rect.left;

                            // Защита от деления на 0
                            if (rect.width > 0) {
                                // Ограничиваем значение от 0 до 100%
                                const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
                                window.audioPlayer.seek(percent);
                            }
                        }
                        return;
                    }

                    // В остальных случаях — запускаем или ставим на паузу
                    proccessPlayer();
                },

                // Если нужен долгий тап на аудиоплеере (например, вызывающий меню сообщения)
                onLongTap: (event) => {
                    if (IsMobile.get()) {
                        if (event.cancelable) event.preventDefault();

                        // У голосового нет скачивания — хост без initDownload,
                        // меню не откроется (фикс b3a6998)
                        audioContextMenuHandler(event, {});
                    }
                }
            },

            // Контекстное меню для ПК (правый клик)
            onContextMenu: (event) => {
                event.preventDefault();
                if (!IsMobile.get()) {
                    audioContextMenuHandler(event, {});
                }
            }
        });

    }

    // **************************************************************************
    // Подписка на глобальные события плеера
    // **************************************************************************
    function globalEvents(): void {

        // Ключ подписки — идентификатор вложения: рассылка идёт всем
        // подписчикам, компонент фильтрует состояние по trackId сам
        const playerCallback: AudioPlayerCallback = (info) => handlePlayerUpdate(info);
        window.audioPlayer.subscribe(String(current.id), playerCallback);

    }

    // **************************************************************************
    // Обработка данных от плеера
    // **************************************************************************
    function handlePlayerUpdate(info: Partial<AudioPlayerState>): void {

        // Если ID трека от плеера совпадает с ID этого вложения
        if (info && info.trackId === current.id) {
            renderProgress(info);
            playButton?.setIcon(info.isPlaying ? "player-pause" : "player-play", { settings: { filled: true } });
        } else {
            // Если играет другой трек или плеер остановлен
            resetUI();
        }

    }

    // **************************************************************************
    // Логика запуска/паузы воспроизведения
    // **************************************************************************
    function proccessPlayer(): void {

        // Локальный файл (секретные чаты) ещё не принят: без _file и серверного
        // токена плееру нечего играть — ждём file::done
        if (!(current._file instanceof File || current._file instanceof Blob) && !current.token) return;

        // Если этот трек уже в плеере — просто переключаем Play/Pause
        if (window.audioPlayer?.audioData?.id === current.id) {
            window.audioPlayer.toggle();
        }
        else {

            // Иначе собираем плейлист из ВСЕХ голосовых сообщений в этом сообщении.
            // Нормализуем: сервер отдаёт массив, локальные (temp/pending) — объект-мап
            // (фикс b330c02: .filter на объекте падал).
            const attachments = normalizeAttachments(message.data?.attachments);
            playlist = attachments
                .filter(at => at.metadata?.flags?.is_audio_note === true || isKind("audio", at.mime_type))
                .map(at => ({
                    ...at,
                    author: at.author || message.data.display_name || window._lc.forms.messages.components.messages.voice_item.voice_message,
                    title: at.title || window._lc.forms.messages.components.messages.voice_item.voice_note
                }));

            // Текущий индекс трека
            const index = playlist.findIndex(item => item.id === current.id);

            // Запускаем плеер с плейлистом
            window.audioPlayer.play(playlist, null, { after: true }, index >= 0 ? index : 0);

        }

    }

    // **************************************************************************
    // Метод для отрисовки прогресса по барам осциллограммы
    // **************************************************************************
    function renderProgress(info: Partial<AudioPlayerState>): void {

        if (!waveForm) return;

        const { progress = 0, currentTime } = info;
        const bars = waveForm.querySelectorAll<HTMLElement>(".wave-bar");
        const totalBars = bars.length;

        // Вычисляем, сколько баров должны быть "активными" (непрозрачными)
        const activeBarsCount = Math.floor((progress / 100) * totalBars);

        // Обновляем прозрачность каждого бара
        bars.forEach((bar, index) => {
            bar.style.opacity = index < activeBarsCount ? "1" : "0.5";
        });

        // Обновляем текстовое время
        if (durationEl) {
            durationEl.textContent = currentTime ?? null;
        }

    }

    // **************************************************************************
    // Сброс состояния UI в исходное
    // **************************************************************************
    function resetUI(): void {
        playButton?.setIcon("player-play", { settings: { filled: true } });

        // Сбрасываем все бары в полупрозрачное состояние
        if (waveForm) {
            const bars = waveForm.querySelectorAll<HTMLElement>(".wave-bar");
            bars.forEach(bar => bar.style.opacity = "0.5");
        }

        // Возвращаем исходную длительность
        const originalDuration = current.metadata?.original?.duration || current.metadata?.duration;
        if (originalDuration && durationEl) {
            durationEl.textContent = formatTime(originalDuration);
        }
    }

    // **************************************************************************
    // Форматирование времени
    // **************************************************************************
    function formatTime(seconds: number): string {
        if (!seconds || isNaN(seconds)) return "0:00";
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec.toString().padStart(2, "0")}`;
    }

    // Создаем DOM-элемент из шаблона
    const element = template();

    // Записываем ссылки для внешних манипуляций
    if (!data.__domElements__) {
        data.__domElements__ = [];
    }
    data.__domElements__.push(element);

    // Хуки обновления/чтения: __update__ объединяет поля (merge), как в легаси
    data.__update__ = (next) => {
        current = { ...current, ...next };
        setup(current);
    };
    data.__getData__ = () => current;

    // Ссылки на DOM элементы (запрашиваются один раз, как в легаси-конструкторе)
    const waveForm = element.querySelector<HTMLElement>("[data-wave-form]");
    const durationEl = element.querySelector<HTMLElement>("[data-duration]");

    // Устанавливаем начальные данные
    setup(data);

    // Прикрепляем обработчики событий
    actions();

    // Подписываемся на обновления глобального плеера
    globalEvents();

    return element;

}
