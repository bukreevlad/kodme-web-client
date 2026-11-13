import { afterEach, expect, mock, test } from "bun:test";
import { VideoRecorder } from "../js/utils/video/video_note_recorder.js";

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const originalMediaRecorder = Object.getOwnPropertyDescriptor(globalThis, "MediaRecorder");
afterEach(() => {
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else Reflect.deleteProperty(globalThis, "navigator");
    if (originalMediaRecorder) Object.defineProperty(globalThis, "MediaRecorder", originalMediaRecorder);
    else Reflect.deleteProperty(globalThis, "MediaRecorder");
});

function setup() {
    let native!: FakeMediaRecorder;
    class FakeMediaRecorder {
        onstart: (() => void) | null = null;
        onerror: (() => void) | null = null;
        start = mock(() => {});
        constructor() { native = this; }
    }
    Object.defineProperty(globalThis, "MediaRecorder", { configurable: true, value: FakeMediaRecorder });
    const stream = { active: true, getAudioTracks: () => [] };
    Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: { mediaDevices: { getUserMedia: async () => stream } }
    });
    const recorder = Object.assign(Object.create(VideoRecorder.prototype), {
        isRecording: false,
        videoSource: { play: async () => {} },
        canvas: { captureStream: () => stream },
        _startRenderLoop: mock(() => {}),
        _setupPreview: mock(() => {}),
        _startTimer: mock(() => {}),
        _cleanup: mock(() => {})
    }) as VideoRecorder;
    return { recorder, getNative: () => native };
}

test("запуск видеокружка дожидается onstart до показа интерфейса", async () => {
    const { recorder, getNative } = setup();
    let ready = false;
    const started = recorder.start({} as HTMLElement).then(() => { ready = true; });
    // getUserMedia и play завершились, нативный start только поставил событие в очередь.
    await Promise.resolve();
    await Promise.resolve();
    expect(getNative().start).toHaveBeenCalledWith(100);
    expect(ready).toBe(false);
    expect(recorder.isRecording).toBe(false);
    getNative().onstart!();
    await started;
    expect(ready).toBe(true);
    expect(recorder.isRecording).toBe(true);
    expect(recorder._startTimer).toHaveBeenCalledTimes(1);
});

test("ошибка запуска рекордера отклоняет запуск и освобождает ресурсы", async () => {
    const { recorder, getNative } = setup();
    const started = recorder.start({} as HTMLElement);
    await Promise.resolve();
    await Promise.resolve();
    getNative().onerror!();
    await expect(started).rejects.toThrow("MediaRecorder start failed");
    expect(recorder._cleanup).toHaveBeenCalledTimes(1);
});
