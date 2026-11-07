// Импортируем сторонние пакеты
import { ScreenSharePresets, VideoPreset, Track } from "livekit-client";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем типы
import type { MeetScreenSettings } from "../index.js";

/**
 * Guard: ключ пресета есть в списке ScreenSharePresets.
 * Без него обращение к пресету по произвольной строке из DOM не типизируется;
 * сравнение поведение-идентично прежнему `ScreenSharePresets[key] || fallback`
 * (отсутствующий ключ молча получал запасной пресет).
 * @param key - Ключ пресета из формы.
 * @returns true, если ключ есть в списке пресетов.
 */
function isScreenSharePresetKey(key: string): key is keyof typeof ScreenSharePresets {
    return key in ScreenSharePresets;
}

/**
 * ***************************************************************************
 * saveScreenSettingsHandler - Сохраняет настройки демонстрации экрана и, если
 *           демонстрация уже идёт, перезапускает её с новым пресетом.
 * @param form - Форма настроек демонстрации.
 * @returns Промис сохранения настроек.
 * ***************************************************************************
 */
export async function saveScreenSettingsHandler(form: MeetScreenSettings): Promise<void> {

    try {

        // Без шаблона сохранять нечего
        const tpl = form.tpl;
        if (!tpl) return;

        const saveBtn = tpl.querySelector<HTMLButtonElement>(":scope >.header [action-save]");
        const resolution = tpl.querySelector<HTMLSelectElement>(`[data-setting="resolution"]`);
        const fpsSelect = tpl.querySelector<HTMLSelectElement>(`[data-setting="fps"]`);

        // Поля обязаны входить в шаблон — иначе сохранять нечего
        if (!saveBtn || !resolution || !fpsSelect) return;

        const resolutionKey = resolution.value;
        const fps = parseInt(fpsSelect.value);

        // Кнопка сохранения теперь иконочная (шапка формы), поэтому «занятость»
        // показываем блокировкой и aria-busy, а не подменой подписи: запись
        // в innerText стёрла бы иконку. Блокированная кнопка гаснет до 50%
        // за счёт общего стиля кнопок (`disabled:opacity-50`)
        saveBtn.disabled = true;
        saveBtn.setAttribute("aria-busy", "true");

        let selectedPreset: VideoPreset | undefined = undefined;
        if (resolutionKey === "original") {
            selectedPreset = undefined;
        } else {
            // Ключ из списка формы сверяем с белым списком пресетов;
            // неизвестный (например, h360fps30, которого у LiveKit нет)
            // по-прежнему молча заменяется запасным — как и раньше
            const base = isScreenSharePresetKey(resolutionKey)
                ? ScreenSharePresets[resolutionKey]
                : ScreenSharePresets.h720fps15;
            selectedPreset = new VideoPreset({
                width: base.width,
                height: base.height,
                // Битрейт пресета живёт в его encoding (у VideoPreset нет
                // прямого поля maxBitrate)
                maxBitrate: base.encoding.maxBitrate,
                // Частоту кадров пресет не принимает (опций пресета только
                // геометрия и битрейт) — её задаёт frameRate разрешения
                // ниже, поэтому здесь она и не дублируется
                priority: "high" // Ставим высокий приоритет для потока
            });
        }

        // ---------- ЗВУК ----------
        // Читаем из DOM, а не полагаемся на currentSettings: галочка
        // меняет состояние по событию change, но и программная установка
        // (или сброс формы) сюда бы не попала. Строгое сравнение —
        // `checked === false` означает «сняли», а не «не задано»
        const captureAudio = tpl.querySelector<HTMLInputElement>("[data-audio]")?.checked !== false;
        // ---------- ЗВУК ----------

        // Родительская форма встречи и её комната обязательны — как в
        // легаси, без них сохранение падает в catch с тостом
        const meetPlayForm = form.meetPlayForm;
        if (!meetPlayForm) throw new Error("[screen-settings]: не найдена форма встречи");

        meetPlayForm.screenSettings = {
            presetKey: resolutionKey,
            fps: fps,
            resolution: selectedPreset,
            captureAudio: captureAudio
        };

        const room = meetPlayForm.room;
        if (!room) throw new Error("[screen-settings]: не найдена комната встречи");
        const participant = room.localParticipant;

        if (participant.isScreenShareEnabled) {
            // 1. Сначала выключаем
            await participant.setScreenShareEnabled(false);

            // 2. Включаем с расширенными опциями
            await participant.setScreenShareEnabled(true, {
                // Частота кадров живёт в frameRate самого разрешения:
                // отдельной опции для неё у захвата экрана нет, а прежняя
                // `videoCaptureOptions` такой опции не существовала — браузер
                // её молча игнорировал, и выбор fps в форме не доходил
                // до getDisplayMedia
                ...(selectedPreset
                    ? { resolution: { ...selectedPreset.resolution, frameRate: fps } }
                    : {}),
                // Звук при демонстрации — по настройке пользователя.
                // Без этого параметра LiveKit всё равно запросил бы
                // звук по умолчанию, а вкладка уехала бы слушателям
                // вместе с галочкой браузера
                audio: captureAudio,
                // ВАЖНО: Подсказываем браузеру, что нам нужна плавность (движение)
                // Это убирает лимит 10-15 FPS, который браузер ставит для статики
                contentHint: fps > 15 ? "motion" : "detail"
            });

            // 3. Дополнительный "пинок" для энкодера через опубликованный трек
            const screenTrack = participant.getTrackPublication(Track.Source.ScreenShare)?.videoTrack;
            if (screenTrack) {
                // Устанавливаем предпочтение деградации: лучше снизить четкость, чем потерять плавность (FPS)
                await screenTrack.setDegradationPreference("maintain-framerate");
            }
        }

        // Toast
        Toast.success(window._lc.forms.meet_play.toasts.success_save);

        form.modal?.close();

    } catch (error) {
        Logger.error("Ошибка сохранения настроек экрана:", error);

        // Toast
        Toast.error(window._lc.forms.meet_play.toasts.save_error);

        // Возвращаем кнопку в исходное состояние при ошибке
        const saveBtn = form.tpl?.querySelector<HTMLButtonElement>(":scope >.header [action-save]");
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.removeAttribute("aria-busy");
        }
    }

}
