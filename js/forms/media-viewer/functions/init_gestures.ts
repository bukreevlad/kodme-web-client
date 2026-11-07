// Импортируем utils
import { GestureController } from "../../../utils/gesture_controller.js";

// Импортируем functions
import { showMedia } from "./show_media.js";
import { resetView } from "./reset_view.js";
import { toggleZoom } from "./toggle_zoom.js";
import { applyTransform } from "./apply_transform.js";
import { constrainPosition } from "./constrain_position.js";
import { updateGestureMode } from "./update_gesture_mode.js";

// Импортируем типы
import type { SwipeDirection, SwipeOptions } from "../../../utils/gesture_controller.js";
import type { MediaViewer } from "../index.js";

/**
 * ***************************************************************************
 * Инициализация жестов сцены: свайпы (перелистывание/закрытие), панорамирование
 * при зуме, щипок масштаба и тап/двойной тап.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function initGestures(form: MediaViewer): void {

    // Вертикальные свайпы есть всегда, горизонтальные — только при нескольких медиа
    const swipeDirs: SwipeDirection[] = ["up", "down"];
    if (form.media.length > 1) {
        swipeDirs.push("left", "right");
    }

    const swipeConfig: SwipeOptions = {
        directions: swipeDirs,
        onMove: (dx, dy, dir, progress) => {
            if (form.isTransitioning || form.gestureLocked) return;
            const track = form.elements.track;

            // Трек задаётся шаблоном сцены — без него двигать нечего
            if (!track) return;

            if (dir === "left" || dir === "right") {
                form.tempDX = dx;
                track.style.transform = `translate3d(${dx}px, 0, 0)`;
            } else {
                form.tempDY = dy;
                track.style.transform = `translate3d(0, ${dy}px, 0)`;
                track.style.opacity = String(1 - progress);
            }
        },
        onCommit: (dir) => {

            // Свайп вверх/вниз — закрытие просмотрщика
            if (dir === "up" || dir === "down") {
                form.modal?.close();
                return;
            }

            if (form.gestures) {
                form.gestures.active = false;
            }

            if (form.isTransitioning) return;

            // Анимация ухода трека и пересборка слотов после перехода.
            // Узлы задаются шаблоном сцены; guard ставим до взвешивания
            // флагов блокировки — иначе их никто не снимет
            const track = form.elements.track;
            const stage = form.elements.stage;
            if (!track || !stage) return;

            form.isTransitioning = true;
            form.gestureLocked = true;

            const w = stage.clientWidth;
            const targetDX = dir === "left" ? -w : w;

            track.style.transition = "transform 0.3s cubic-bezier(0.2, 0, 0.2, 1)";
            track.style.transform = `translate3d(${targetDX}px, 0, 0)`;

            setTimeout(async () => {
                await showMedia(form, form.currentIndex + (dir === "left" ? 1 : -1));

                track.style.transition = "none";
                track.style.transform = `translate3d(0, 0, 0)`;

                requestAnimationFrame(() => {
                    form.isTransitioning = false;
                    form.gestureLocked = false;
                });
            }, 300);
        },
        onCancel: () => resetView(form, true)
    };

    // Конфиг переиспользуется в updateGestureMode: при зуме свайпы
    // выключаются, при возврате к 1 — включаются тот же объект
    form._swipeConfig = swipeConfig;

    // Сцена задаётся шаблоном — без неё жесты не к чему привязать
    const stage = form.elements.stage;
    if (!stage) return;

    form.gestures = new GestureController(stage, {
        threshold: 8,
        swipe: swipeConfig,
        pan: {
            freeMove: true,
            onStart: () => {
                form.gestureLocked = false;
                form.startPanX = form.posX;
                form.startPanY = form.posY;
            },
            onMove: (dx, dy) => {
                if (form.zoom > 1 && !form.gestureLocked) {
                    form.posX = form.startPanX + dx;
                    form.posY = form.startPanY + dy;
                    applyTransform(form, false);
                }
            },
            onEnd: () => {
                if (form.zoom > 1) {
                    constrainPosition(form);
                    applyTransform(form, true);
                }
            }
        },
        pinch: {
            onStart: (midpoint) => {
                form.startZoom = form.zoom;
                form.startPinchX = form.posX;
                form.startPinchY = form.posY;
                form.startMidpoint = midpoint;
            },
            onMove: (scale, midpoint) => {
                // maxZoom опционален в типе — конструктор задаёт по умолчанию 3
                form.zoom = Math.min(Math.max(1, form.startZoom * scale), form.options.maxZoom ?? 3);

                if (form.zoom > 1) {
                    form.posX = form.startPinchX + (midpoint.x - form.startMidpoint.x);
                    form.posY = form.startPinchY + (midpoint.y - form.startMidpoint.y);
                }
                applyTransform(form, false);
            },
            onEnd: () => {
                constrainPosition(form);
                applyTransform(form, true);
                updateGestureMode(form);
            }
        },
        tap: {
            onTap: () => {

                // Блокируем срабатывание двойного тапа посреди пары одиночных
                if (form._tapBlocker) return;
                form._tapBlocker = true;
                setTimeout(() => { form._tapBlocker = false; }, 50);

                const now = performance.now();
                const diff = now - form.lastTapTime;

                // Двойной тап — зум, одиночный — просто запоминаем время
                if (diff > 50 && diff < 300) {
                    toggleZoom(form);
                    form.lastTapTime = 0;
                } else {
                    form.lastTapTime = now;
                }
            }
        }
    });

}
