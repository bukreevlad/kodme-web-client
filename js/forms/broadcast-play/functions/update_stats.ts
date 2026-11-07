// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { formatBytes } from "../../../utils/string/format_bytes.js";

// Импортируем functions
import { createStatChip } from "./stat_chip.js";

// Импортируем типы
import type { BroadcastPlay } from "../index.js";
import type { StatChipName, StreamInfo } from "../types.js";

// Порядок чипов задаётся здесь, а не в шаблоне: строка статистики
// становится одной таблицей данных, и добавить показатель — это одна
// запись, а не ещё один блок разметки в _template()
const CHIPS: { name: StatChipName; iconName: string; value: string }[] = [
    { name: "watching", iconName: "Eye", value: "0" },
    { name: "timing", iconName: "Clock", value: "00:00" },
    { name: "resolution", iconName: "ScreenShare", value: "0p" },
    { name: "fps", iconName: "device-desktop-analytics", value: "0fps" },
    { name: "bitrate", iconName: "heart-rate-monitor", value: "0mbps" },
    { name: "incoming", iconName: "download", value: "0" }
];

/**
 * ***************************************************************************
 * UPDATE_STATS - строит чипы статистики (один раз) и обновляет их значения.
 *
 * Зачем одна функция на всё
 * ------------------------------------------------
 * Раньше значения разъезжались по трём местам: `update()` в index.ts писал
 * зрителей, качество и fps, `stream_info_update.ts` писал те же поля ещё
 * раз после ответа `get stream info`, а `rtc_stats_update.ts` и
 * `start_flv_player.ts` правили fps отдельно. Каждое место форматировало
 * значение по-своему, поэтому нули отображались как факт («0p», «0mbps»).
 *
 * Теперь форматирование и отрисовка в одном месте, а остальные модули
 * просто дёргают эту функцию. Ссылки на узлы значений выставляются в
 * `form.<name>` под теми же именами, что и раньше, поэтому
 * `cast_timing_update` и RTC-статистика работают без изменений.
 *
 * @param form - Экземпляр формы.
 * @param stream - Данные потока. По умолчанию — из формы.
 * @returns true, если значения обновлены.
 * ***************************************************************************
 */
export function updateStats(form: BroadcastPlay, stream?: StreamInfo | null): boolean {

    try {

        // Контейнер чипов. Если его нет — форма уже закрыта или шаблон
        // изменился, ломать из-за этого нечего
        const container = form?.statsWrap || form?.tpl?.querySelector(":scope >.content [data-cast-info]");
        if (!container) return false;

        // ---------- СБОРКА (один раз) ----------
        if (!form.statsMounted) {

            // Очищаем контейнер: шаблон мог прийти с разметкой чипов,
            // и мы бы получили их дубль
            container.replaceChildren();

            // Создаём чипы и запоминаем ссылки под прежними именами
            for (const chip of CHIPS) {
                const created = createStatChip({ ...chip });
                container.appendChild(created.element);
                form[chip.name] = created.value;
            }

            form.statsMounted = true;

        }

        // ---------- ЗНАЧЕНИЯ ----------
        // Явный null отличаем от «не передано»: вызывающий может сбросить
        // статистику, когда потока нет, и тогда fallback на form.cast.stream
        // подставил бы устаревшие значения обратно
        const data = stream === undefined ? form.cast?.stream : stream;

        // Потока нет — показываем пустые значения, но не нули: «0p» и
        // «0mbps» читаются как сведения о качестве, а не как отсутствие данных
        if (!data) {

            for (const chip of CHIPS) {
                if (chip.name === "timing") continue; // время ведёт cast_timing_update
                const node = form[chip.name];
                if (!node) continue;
                node.textContent = "—";
                node.parentElement?.setAttribute("data-chip-empty", "true");
            }

            return true;

        }

        // Подсчёты. Форматирование — то же самое, что было размазано
        // по трём вызывающим модулям, только теперь в одном месте
        const values: Record<StatChipName, string | undefined> = {
            watching: String(data.readers ?? 0),
            timing: undefined, // заполняется таймером отдельно
            resolution: `${data.video?.height || 0}p`,
            fps: `${Math.round(data.video?.fps || 0)}fps`,
            bitrate: `${data.bitrate?.mbps || 0}mbps`,
            incoming: formatBytes(data.received_total || 0)
        };

        for (const chip of CHIPS) {

            // Таймер длительности не наша зона: его ведёт castTimingUpdate
            if (values[chip.name] === undefined) continue;

            const node = form[chip.name];
            if (!node) continue;

            node.textContent = values[chip.name] ?? null;
            node.parentElement?.setAttribute("data-chip-empty", "false");

        }

        return true;

    } catch (error) {

        // Обновление статистики не должно ронять воспроизведение
        Logger.error(error);
        return false;

    }

}
