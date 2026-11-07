// Импортируем типы
import type { MediaViewer } from "../index.js";

/**
 * ***************************************************************************
 * Ограничение панорамирования зума границами изображения: сдвиг не может
 * увести картинку за пределы сцены.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function constrainPosition(form: MediaViewer): void {

    const stage = form.elements.stage;
    const canvas = form.elements.canvas;
    const img = canvas?.querySelector<HTMLElement>('.cdm-iv-image');

    if (!stage || !img) return;

    const stageW = stage.clientWidth;
    const stageH = stage.clientHeight;
    const imgW = img.offsetWidth * form.zoom;
    const imgH = img.offsetHeight * form.zoom;

    const maxX = Math.max((imgW - stageW) / 2, 0);
    const maxY = Math.max((imgH - stageH) / 2, 0);

    form.posX = Math.min(Math.max(form.posX, -maxX), maxX);
    form.posY = Math.min(Math.max(form.posY, -maxY), maxY);

}
