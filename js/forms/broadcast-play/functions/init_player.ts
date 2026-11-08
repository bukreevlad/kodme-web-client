// Импортируем utils
import { CacheManager } from "../../../utils/cache_manager.js";
import { getThumbnailSizeQuery } from "../../../utils/helpers/get_thumbnail_size_query.js";

// Импортируем components
import { VideoPlayer } from "../../../components/video_player.js";

// Импортируем functions
import { playerEvents } from "./player_events.js";
import { globalEvents } from "./global_events.js";
import { startFLVPlayer } from "./start_flv_player.js";
import { startHLSPlayer } from "./start_hls_player.js";
import { startRTCPlayer } from "./start_rtc_player.js";
import { streamInfoUpdate } from "./stream_info_update.js";
import { syncLiveState } from "./sync_live_state.js";

// Импортируем типы
import type { BroadcastPlay } from "../index.js";

/**
 * ***************************************************************************
 * INIT_PLAYER - создание плеера трансляции и запуск потока.
 *
 * Вызывается из _onOpen(), а не из _onBeforeOpen(): форма на этом этапе
 * уже вставлена в документ, и скин Video.js конструируется подключённым.
 * С MediaViewer (js/forms/media-viewer/index.js) поведение совпадает 1:1 —
 * там плеер тоже создаётся после вставки формы. Создание в отсоединённом
 * дереве приводило к тому, что стили packaged-скина не применялись: панель
 * управления вырождалась в ряд неоформленных кнопок.
 *
 * @param form - Экземпляр формы BroadcastPlay.
 * ***************************************************************************
 */
export function initPlayer(form: BroadcastPlay): void {

    // Плеер уже есть — повторный вызов не пересобирает ничего
    if (form.player) return;

    // Создаем плеер.
    //
    // VideoPlayer оборачивает нативный <video>, а не заменяет его, поэтому
    // hls.js / mpegts.js / WHEP продолжают работать с тем же элементом
    // (form.video — геттер, отдаёт player.video).
    //
    // Вариант "full" даёт готовый набор контролов, повторяющий прежний
    // набор Plyr: play / mute / volume / fullscreen / pip, плюс меню
    // качества (для HLS) и скорости. wideControl добавляет в контролы
    // переключатель ширины сцены (его действие — handlers/wide.ts)
    form.player = new VideoPlayer({
        insertInto: form.videoMount,
        options: {
            variant: "full",
            autoplay: true,
            playsinline: true,
            ratio: "16:9",
            wideControl: true
        }
    });

    // Прослушиватели
    playerEvents(form);
    globalEvents(form);

    // Получаем обложку
    if (form.cast?.thumbnail) {

        // Получаем обложки
        const thumbnails = form.cast.thumbnail.metadata?.thumbnails;
        const sizeQuery = getThumbnailSizeQuery(thumbnails, 800);

        // Формируем ссылку через CacheManager
        const mediaUrl = CacheManager.getMediaSrc({
            url: `${window.location.protocol}//${window.location.hostname}/api/v1/storage/${form.cast.thumbnail.id}${sizeQuery.string}`,
            file_token: form.cast.thumbnail.token,
            type: "image"
        });

        // Устанавливаем постер
        if (form.player) form.player.poster = mediaUrl;

    }

    // Если трансляция активна
    if (form.cast?.is_live) {

        // Эфир объявлен активным ответом "[broadcast]: open" — сразу
        // помечаем поток живым и синхронизируем форму.
        //
        // Опрос stream_info_update остаётся арбитром: если потока на самом
        // деле нет, он вернёт пустой ответ и состояние «эфир не идёт»
        form.isStreamLive = true;
        syncLiveState(form);

        // Если тип проигрывания flv
        if (form.typePlay === "flv") {
            startFLVPlayer(form);
        }

        // Если тип проигрывания hls
        if (form.typePlay === "hls") {
            startHLSPlayer(form);
        }

        // Если тип проигрывания rtc
        if (form.typePlay === "rtc") {
            startRTCPlayer(form);
        }

    }

    // Первый опрос состояния потока запускаем сразу, а не через интервал:
    // так живость подтверждается сервером в течение сотен миллисекунд,
    // а не через 5 секунд ожидания первого тика
    streamInfoUpdate(form);

    // Запускаем таймер обновления трансляции
    form.castUpdaterTiming = setInterval(() => { streamInfoUpdate(form); }, 5000);

}
