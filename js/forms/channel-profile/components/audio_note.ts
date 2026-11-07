// Импортируем справочник типов файлов
import { isKind } from "../../../config/file_types.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { IsMobile } from "../../../utils/helpers/is_mobile.js";
import { GestureController } from "../../../utils/gesture_controller.js";

// Импортируем components
import { Buttons } from "../../../components/buttons.js";

// Импортируем handlers
import { ContextMenuHandler } from "./handlers/context_menu.js";
import { readEventPoint } from "../../../utils/dom/read_event_point.js";

// Импортируем типы
import type { ChannelSectionItemData, ChannelProfile } from "../types.js";
import type { AudioPlayerCallback, AudioPlayerTrack } from "../../../utils/audio/audio_player.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * VoiceItem - строка вкладки «Голосовые» профиля канала.
 * Синхронизируется с глобальным AudioPlayerManager через систему подписок.
 *
 * Конструктор НЕ возвращает DOM-элемент (класс-фабрика — красный флаг
 * миграции): элемент отдаёт поле element, его берёт subscribe_section.
 * ***************************************************************************
 */
export class VoiceItem {

    /** Форма-владелец строки. */
    form: ChannelProfile;

    /** Данные вложения (id, token, metadata и т.д.). */
    data: ChannelSectionItemData;

    /** Корневой DOM-элемент строки. */
    element: HTMLElement;

    /** Кнопка воспроизведения. */
    playButton: Buttons | null = null;

    /** Контейнер осциллограммы. */
    waveForm: HTMLElement | null = null;

    /** Имя автора голосового (display_name строки секции). */
    displayNameEl: HTMLElement | null = null;

    /** Длительность/позиция воспроизведения. */
    durationEl: HTMLElement | null = null;

    /** Контроллер жестов (tap/long tap/context menu). */
    gestureController: GestureController | null = null;

    /** Колбэк подписки на глобальный аудиоплейер. */
    playerCallback: AudioPlayerCallback | null = null;

    /** Плейлист, собранный из секции перед запуском плеера. */
    playlist: AudioPlayerTrack[] = [];

    /**
     * ***************************************************************************
     * constructor - Создаёт строку голосового, вешает обработчики и подписки.
     * @param form - Экземпляр формы профиля канала.
     * @param data - Данные вложения.
     * ***************************************************************************
     */
    constructor(form: ChannelProfile, data: ChannelSectionItemData) {

        // Записываем данные
        this.form = form;
        this.data = data;

        // Создаем DOM-элемент из шаблона
        this.element = this._template();

        // Проставляем id элементу: по нему ScrollManager ищет якорь скролла
        // при вставке пачки в начало списка (см. functions/load_section.ts)
        if (data?.id) this.element.setAttribute("data-id", String(data.id));

        // Записываем ссылки для внешних манипуляций
        if (!this.data.__domElements__) {
            this.data.__domElements__ = [];
        }
        this.data.__domElements__.push(this.element);
        this.data.__update__ = (data) => this.update(data);
        this.data.__getData__ = () => this.getData();

        // Отписка от глобальных событий (аудиоплейер): вызывается из
        // events/store/subscribe_section при удалении строки из Store
        this.data.__destroy__ = () => this.destroy();

        // Ссылки на DOM элементы
        this.waveForm = this.element.querySelector("[data-wave-form]");
        this.displayNameEl = this.element.querySelector("[data-display-name]");
        this.durationEl = this.element.querySelector("[data-duration]");

        // Устанавливаем начальные данные
        this._setup(this.data);

        // Прикрепляем обработчики событий
        this._actions();

        // Подписываемся на обновления глобального плеера
        this._globalEvents();

    }

    /**
     * ***************************************************************************
     * Шаблон элемента (Private Method)
     * ***************************************************************************
     */
    _template(): HTMLElement {

        const tpl = new DOMParser().parseFromString(`
            <div class="item audio-note flex flex-row items-center w-full gap-2 p-1 rounded-lg hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] cursor-pointer select-none">
                <button action-play></button>
                <div class="flex flex-col gap-0 justify-center overflow-hidden flex-1">
                    <div class="flex flex-row justify-between items-center gap-2">
                        <span data-display-name class="text-secondary text-sm truncate"></span>
                        <span data-duration class="text-muted text-xs shrink-0">0:00</span>
                    </div>
                    <div data-wave-form class="flex flex-row w-full items-center gap-[1px]" style="height: 30px;"></div>
                </div>
            </div>
        `, "text/html").querySelector<HTMLElement>(".item");

        // invariant: шаблон выше всегда содержит корневой .item
        if (!tpl) throw new Error("Не удалось разобрать шаблон строки голосового");

        return tpl;

    }

    /**
     * ***************************************************************************
     * Установка/Перерисовка данных (Private Method)
     * ***************************************************************************
     */
    async _setup(data: ChannelSectionItemData): Promise<void> {

        try {

            // Обновляем данные
            this.data = data;

            // Устанавливаем кнопку управления
            const playButton = this.element.querySelector("[action-play]");
            this.playButton = Buttons.circle({
                attributes: ["action-play"],
                icon: "player-play",
                intent: "primary"
            });

            // Заменяем элемент кнопки
            playButton?.replaceWith(this.playButton.dom);

            // Отрисовка осциллограммы (wave_form)
            const wave_form = this.data.metadata?.wave_form;

            if (wave_form && Array.isArray(wave_form)) {
                // Очищаем старую волну, если это update
                if (this.waveForm) this.waveForm.innerHTML = "";

                wave_form.forEach(amplitude => {
                    const bar = document.createElement("div");
                    // Гарантируем минимальную высоту в 10%, чтобы тишина тоже была видна
                    const heightPercent = Math.max(amplitude * 100, 10);
                    bar.style.height = `${heightPercent}%`;
                    bar.className = "wave-bar flex-1 min-w-[.15rem] bg-[var(--color-brand)] dark:bg-[var(--color-brand)] rounded-full transition-opacity duration-100";
                    bar.style.opacity = "0.5"; // По умолчанию непроигранные бары полупрозрачные
                    this.waveForm?.appendChild(bar);
                });
            }

            // Имя автора: сервер отдаёт display_name прямо в строке секции
            // (join по автору документа) — рендерим, если оно есть
            if (this.displayNameEl) {
                this.displayNameEl.textContent = this.data.display_name ?? "";
            }

            // Установка длительности
            const originalDuration = this.data.metadata?.original?.duration || this.data.metadata?.duration;
            if (originalDuration && this.durationEl) {
                this.durationEl.textContent = this._formatTime(originalDuration);
            }

        } catch (error) {
            Logger.error("Setup Error:", error);
        }

    }

    /**
     * ***************************************************************************
     * Обработчики событий (Private Method)
     * ***************************************************************************
     */
    _actions(): void {

        // GestureController
        this.gestureController = new GestureController(this.element, {
            threshold: 5,
            tap: {
                onTap: (event) => {
                    // event.target — EventTarget: ближайший узел ищем только у Element
                    const target = event.target instanceof Element ? event.target : null;

                    // Проверяем, был ли клик по дорожке осциллограммы
                    const waveTarget = target?.closest("[data-wave-form]");

                    // Если кликнули по волне И этот трек сейчас активен в плеере — перематываем
                    if (waveTarget && window.audioPlayer?.audioData?.id === this.data.id) {
                        // Важно: в touch-событиях координаты лежат в changedTouches,
                        // а в MouseEvent — в clientX
                        const point = readEventPoint(event);
                        const clientX = point?.x;

                        if (this.waveForm && clientX !== undefined) {
                            const rect = this.waveForm.getBoundingClientRect();
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
                    this.proccessPlayer();
                },

                // Если нужен долгий тап на аудиоплеере (например, вызывающий меню сообщения)
                onLongTap: (event) => {
                    if (IsMobile.get()) {
                        if (event.cancelable) event.preventDefault();
                        ContextMenuHandler(event, this, "audioNote");
                    }
                }
            },

            // Контекстное меню для ПК (правый клик)
            onContextMenu: (event) => {
                event.preventDefault();
                if (!IsMobile.get()) {
                    ContextMenuHandler(event, this, "audioNote");
                }
            }
        });

    }

    /**
     * ***************************************************************************
     * Подписка на глобальные события плеера
     * ***************************************************************************
     */
    _globalEvents(): void {
        this.playerCallback = (info) => this._handlePlayerUpdate(info);
        // Ключ подписки — строка: id записи приводим к строке и в
        // subscribe, и в unsubscribe, чтобы отписка гарантированно совпала
        window.audioPlayer.subscribe(String(this.data.id), this.playerCallback);
    }

    // ***************************************************************************
    // Метод для очистки при удалении сообщения из DOM
    // ***************************************************************************
    destroy(): void {
        this.gestureController?.destroy();

        // Подписка ставилась вместе с колбэком — без него отписываться нечего
        const callback = this.playerCallback;
        if (callback) {
            window.audioPlayer.unsubscribe(String(this.data.id), callback);
        }
    }

    /**
     * ***************************************************************************
     * Обработка данных от плеера
     * ***************************************************************************
     */
    _handlePlayerUpdate(info: Parameters<AudioPlayerCallback>[0]): void {

        // Если ID трека от плеера совпадает с ID этого вложения
        if (info && info.trackId === this.data.id) {
            this._renderProgress(info);
            this.playButton?.setIcon(info.isPlaying ? "player-pause" : "player-play", { settings: { filled: true } });
        } else {
            // Если играет другой трек или плеер остановлен
            this._resetUI();
        }

    }

    /**
     * ***************************************************************************
     * Логика запуска/паузы воспроизведения
     * ***************************************************************************
     */
    proccessPlayer(): void {

        // Если этот трек уже в плеере — просто переключаем Play/Pause
        if (window.audioPlayer?.audioData?.id === this.data.id) {
            window.audioPlayer.toggle();
        }
        else {

            // Иначе собираем плейлист из ВСЕХ голосовых сообщений в этом MessageItem
            const attachments = this.form?.audioNoteStore?.getAll();
            this.playlist = attachments
                .filter(at => at.metadata?.flags?.is_audio_note === true || isKind("audio", at.mime_type))
                .map(at => ({
                    ...at,
                    author: at.author || this.data.display_name || t("forms.messages.components.messages.voice_item.voice_message"),
                    title: at.title || t("forms.messages.components.messages.voice_item.voice_note")
                }));

            // Текущий индекс трека
            const index = this.playlist.findIndex(item => item.id === this.data.id);

            // Запускаем плеер с плейлистом
            window.audioPlayer.play(this.playlist, null, { after: true }, index >= 0 ? index : 0);

        }

    }

    /**
     * ***************************************************************************
     * Метод для отрисовки прогресса по барам осциллограммы
     * ***************************************************************************
     */
    _renderProgress(info: Parameters<AudioPlayerCallback>[0]): void {

        if (!this.waveForm) return;

        const { progress = 0, currentTime } = info;
        const bars = this.waveForm.querySelectorAll<HTMLElement>(".wave-bar");
        const totalBars = bars.length;

        // Вычисляем, сколько баров должны быть "активными" (непрозрачными)
        const activeBarsCount = Math.floor((progress / 100) * totalBars);

        // Обновляем прозрачность каждого бара
        bars.forEach((bar, index) => {
            bar.style.opacity = index < activeBarsCount ? "1" : "0.5";
        });

        // Обновляем текстовое время
        if (this.durationEl) {
            this.durationEl.textContent = currentTime ?? null;
        }

    }

    /**
     * ***************************************************************************
     * Сброс состояния UI в исходное
     * ***************************************************************************
     */
    _resetUI(): void {
        this.playButton?.setIcon("player-play", { settings: { filled: true } });

        // Сбрасываем все бары в полупрозрачное состояние
        if (this.waveForm) {
            const bars = this.waveForm.querySelectorAll<HTMLElement>(".wave-bar");
            bars.forEach(bar => bar.style.opacity = "0.5");
        }

        // Возвращаем исходную длительность
        const originalDuration = this.data.metadata?.original?.duration || this.data.metadata?.duration;
        if (originalDuration && this.durationEl) {
            this.durationEl.textContent = this._formatTime(originalDuration);
        }
    }

    /**
     * ***************************************************************************
     * Обновляем данные элемента
     * ***************************************************************************
     */
    update(data: ChannelSectionItemData): void {
        this.data = { ...this.data, ...data };
        this._setup(this.data);
    }

    /**
     * ***************************************************************************
     * Форматирование времени
     * ***************************************************************************
     */
    _formatTime(seconds: number | null | undefined): string {
        if (!seconds || isNaN(seconds)) return "0:00";
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec.toString().padStart(2, "0")}`;
    }

    /**
     * ***************************************************************************
     * Вспомогательные методы
     * ***************************************************************************
     */
    getData(): ChannelSectionItemData { return this.data; }

}
