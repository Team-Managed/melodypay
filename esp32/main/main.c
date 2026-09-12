#include "display.h"
#include "device_api.h"
#include "ggwave_transport.h"
#include "hardware.h"
#include "keystore.h"
#include "wallet_state.h"

#include "nvs_flash.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_console.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "esp_heap_caps.h"

static const char *TAG = "melodypay";

static int16_t mic_sample_to_pcm(int32_t raw)
{
    int64_t value = (int64_t)raw >> 15;
    if (value > INT16_MAX) return INT16_MAX;
    if (value < INT16_MIN) return INT16_MIN;
    return (int16_t)value;
}

static int cmd_tone(int argc, char **argv)
{
    (void)argc;
    (void)argv;
    printf("running 1-second tone and microphone sample test...\n");
    printf("result=%s\n", esp_err_to_name(hardware_run_audio_self_test()));
    return 0;
}

static int cmd_mic(int argc, char **argv)
{
    (void)argc;
    (void)argv;
    int32_t samples[256];
    size_t count = 0;
    esp_err_t result = hardware_read_mic(samples, 256, &count, 500);
    int64_t raw_peak = 0;
    int64_t pcm_peak = 0;
    int32_t raw_min = INT32_MAX;
    int32_t raw_max = INT32_MIN;
    int16_t pcm_min = INT16_MAX;
    int16_t pcm_max = INT16_MIN;
    for (size_t index = 0; index < count; index++) {
        if (samples[index] < raw_min) raw_min = samples[index];
        if (samples[index] > raw_max) raw_max = samples[index];
        int64_t value = samples[index] < 0 ? -(int64_t)samples[index] : samples[index];
        if (value > raw_peak) raw_peak = value;
        int16_t pcm = mic_sample_to_pcm(samples[index]);
        if (pcm < pcm_min) pcm_min = pcm;
        if (pcm > pcm_max) pcm_max = pcm;
        int64_t pcm_value = pcm < 0 ? -(int64_t)pcm : pcm;
        if (pcm_value > pcm_peak) pcm_peak = pcm_value;
    }
    printf("result=%s samples=%u raw_min=%ld raw_max=%ld pcm_min=%d pcm_max=%d raw_peak=%lld pcm_peak=%lld\n",
           esp_err_to_name(result), (unsigned)count, (long)raw_min, (long)raw_max,
           pcm_min, pcm_max, (long long)raw_peak, (long long)pcm_peak);
    return result == ESP_OK ? 0 : 1;
}

static int cmd_micplay(int argc, char **argv)
{
    const int seconds = argc == 1 ? 2 : atoi(argv[1]);
    if (argc > 2 || seconds <= 0 || seconds > 5) {
        printf("usage: micplay [seconds 1-5]\n");
        return 1;
    }

    const size_t capacity = (size_t)seconds * MELODY_SAMPLE_RATE;
    int16_t *recording = heap_caps_malloc(capacity * sizeof(int16_t), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (recording == NULL) recording = heap_caps_malloc(capacity * sizeof(int16_t), MALLOC_CAP_8BIT);
    if (recording == NULL) {
        printf("recording allocation failed for %u samples\n", (unsigned)capacity);
        return 1;
    }

    printf("recording microphone for %d seconds; speak near the INMP441...\n", seconds);
    size_t captured = 0;
    int64_t raw_peak = 0;
    int64_t pcm_peak = 0;
    while (captured < capacity) {
        int32_t raw[256];
        size_t read_count = 0;
        esp_err_t result = hardware_read_mic(raw, 256, &read_count, 500);
        if (result != ESP_OK) {
            printf("microphone read failed: %s\n", esp_err_to_name(result));
            heap_caps_free(recording);
            return 1;
        }
        const size_t remaining = capacity - captured;
        if (read_count > remaining) read_count = remaining;
        for (size_t index = 0; index < read_count; index++) {
            int64_t raw_value = raw[index] < 0 ? -(int64_t)raw[index] : raw[index];
            if (raw_value > raw_peak) raw_peak = raw_value;
            recording[captured + index] = mic_sample_to_pcm(raw[index]);
            int64_t pcm_value = recording[captured + index] < 0
                ? -(int64_t)recording[captured + index]
                : recording[captured + index];
            if (pcm_value > pcm_peak) pcm_peak = pcm_value;
        }
        captured += read_count;
    }

    printf("captured=%u raw_peak=%lld pcm_peak=%lld; playing recording...\n",
           (unsigned)captured, (long long)raw_peak, (long long)pcm_peak);
    hardware_mute_mic();
    esp_err_t result = hardware_play_pcm(recording, captured);
    if (result == ESP_OK) result = hardware_stop_pcm();
    hardware_unmute_mic();
    heap_caps_free(recording);
    printf("result=%s\n", esp_err_to_name(result));
    return result == ESP_OK ? 0 : 1;
}

typedef struct {
    int16_t *samples;
    size_t capacity;
    size_t count;
    volatile bool stop;
    volatile bool done;
    esp_err_t error;
} acoustic_capture_t;

static void acoustic_capture_task(void *argument)
{
    acoustic_capture_t *capture = (acoustic_capture_t *)argument;
    while (!capture->stop && capture->count < capture->capacity) {
        int32_t raw[256];
        size_t read_count = 0;
        capture->error = hardware_read_mic(raw, 256, &read_count, 100);
        if (capture->error != ESP_OK) break;
        size_t remaining = capture->capacity - capture->count;
        if (read_count > remaining) read_count = remaining;
        for (size_t index = 0; index < read_count; index++) {
            capture->samples[capture->count + index] = mic_sample_to_pcm(raw[index]);
        }
        capture->count += read_count;
    }
    capture->done = true;
    vTaskDelete(NULL);
}

static int cmd_acoustic(int argc, char **argv)
{
    (void)argc;
    (void)argv;
    static const uint8_t payload[] = {'h', 'e', 'l', 'l', 'o'};
    const size_t waveform_capacity = ggwave_transport_encode_size(payload, sizeof(payload));
    const size_t capture_capacity = MELODY_SAMPLE_RATE * 2;
    if (waveform_capacity == 0) {
        printf("acoustic encode initialization failed\n");
        return 1;
    }

    int16_t *waveform = heap_caps_malloc(waveform_capacity * sizeof(int16_t), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    int16_t *captured = heap_caps_malloc(capture_capacity * sizeof(int16_t), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (waveform == NULL || captured == NULL) {
        printf("acoustic buffer allocation failed\n");
        heap_caps_free(waveform);
        heap_caps_free(captured);
        return 1;
    }

    const int encoded_samples = ggwave_transport_encode(payload, sizeof(payload), waveform, waveform_capacity);
    if (encoded_samples <= 0) {
        printf("acoustic encode failed: %d\n", encoded_samples);
        heap_caps_free(waveform);
        heap_caps_free(captured);
        return 1;
    }

    acoustic_capture_t capture = {
        .samples = captured,
        .capacity = capture_capacity,
        .count = 0,
        .stop = false,
        .done = false,
        .error = ESP_OK,
    };
    if (xTaskCreate(acoustic_capture_task, "ggcap", 4096, &capture, 5, NULL) != pdPASS) {
        printf("acoustic capture task creation failed\n");
        heap_caps_free(waveform);
        heap_caps_free(captured);
        return 1;
    }

    vTaskDelay(pdMS_TO_TICKS(100));
    printf("acoustic loopback: playing %d samples while capturing...\n", encoded_samples);
    esp_err_t result = hardware_play_pcm(waveform, (size_t)encoded_samples);
    if (result == ESP_OK) result = hardware_stop_pcm();
    capture.stop = true;
    while (!capture.done) vTaskDelay(pdMS_TO_TICKS(10));

    uint8_t decoded_payload[256] = {0};
    int decoded = 0;
    for (size_t offset = 0; offset + 512 <= capture.count && decoded == 0; offset += 512) {
        size_t count = capture.count - offset;
        if (count > 512) count = 512;
        decoded = ggwave_transport_decode(captured + offset, count, decoded_payload, sizeof(decoded_payload));
    }
    printf("acoustic result=%s capture=%u decoded=%d capture_error=%s\n",
           esp_err_to_name(result), (unsigned)capture.count, decoded,
           esp_err_to_name(capture.error));
    ggwave_transport_log_status();
    heap_caps_free(waveform);
    heap_caps_free(captured);
    return decoded > 0 ? 0 : 1;
}

static int cmd_oled(int argc, char **argv)
{
    (void)argc;
    (void)argv;
    esp_err_t result = display_test_pattern();
    printf("oled_connected=%s pattern_result=%s\n", display_is_connected() ? "yes" : "no", esp_err_to_name(result));
    return result == ESP_OK ? 0 : 1;
}

static int cmd_screen(int argc, char **argv)
{
    if (argc < 2) {
        printf("usage: screen <text>\n");
        return 1;
    }

    char text[256] = {0};
    size_t length = 0;
    for (int index = 1; index < argc && length + 1 < sizeof(text); index++) {
        if (index > 1 && length + 1 < sizeof(text)) text[length++] = ' ';
        const size_t remaining = sizeof(text) - length - 1;
        const size_t part_length = strlen(argv[index]);
        const size_t copied = part_length < remaining ? part_length : remaining;
        memcpy(text + length, argv[index], copied);
        length += copied;
    }

    esp_err_t result = display_text(text);
    printf("screen_result=%s text=%s\n", esp_err_to_name(result), text);
    return result == ESP_OK ? 0 : 1;
}

static int cmd_tx(int argc, char **argv)
{
    if (argc < 2) {
        printf("usage: tx <payload>\n");
        return 1;
    }

    char payload_text[64] = {0};
    size_t payload_size = 0;
    for (int index = 1; index < argc; index++) {
        if (index > 1) {
            if (payload_size + 1 >= sizeof(payload_text)) {
                printf("payload is too long; maximum is 63 bytes\n");
                return 1;
            }
            payload_text[payload_size++] = ' ';
        }
        const size_t part_length = strlen(argv[index]);
        if (payload_size + part_length >= sizeof(payload_text)) {
            printf("payload is too long; maximum is 63 bytes\n");
            return 1;
        }
        memcpy(payload_text + payload_size, argv[index], part_length);
        payload_size += part_length;
    }

    const uint8_t *payload = (const uint8_t *)payload_text;
    const size_t sample_count = ggwave_transport_encode_size(payload, payload_size);
    if (sample_count == 0) {
        printf("ggwave encode initialization failed\n");
        return 1;
    }

    int16_t *waveform = heap_caps_malloc(sample_count * sizeof(int16_t), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (waveform == NULL) waveform = heap_caps_malloc(sample_count * sizeof(int16_t), MALLOC_CAP_8BIT);
    if (waveform == NULL) {
        printf("waveform allocation failed for %u samples\n", (unsigned)sample_count);
        return 1;
    }

    const int encoded_samples = ggwave_transport_encode(payload, payload_size, waveform, sample_count);
    if (encoded_samples <= 0) {
        printf("ggwave encode failed: %d\n", encoded_samples);
        heap_caps_free(waveform);
        return 1;
    }

    int64_t waveform_peak = 0;
    for (int index = 0; index < encoded_samples; index++) {
        int64_t value = waveform[index] < 0 ? -(int64_t)waveform[index] : waveform[index];
        if (value > waveform_peak) waveform_peak = value;
    }
    printf("transmitting %u bytes as %d samples waveform_peak=%lld...\n",
           (unsigned)payload_size, encoded_samples, (long long)waveform_peak);
    hardware_mute_mic();
    esp_err_t result = hardware_play_pcm(waveform, (size_t)encoded_samples);
    if (result == ESP_OK) result = hardware_stop_pcm();
    hardware_unmute_mic();
    heap_caps_free(waveform);
    printf("result=%s\n", esp_err_to_name(result));
    return result == ESP_OK ? 0 : 1;
}

static int cmd_ggtest(int argc, char **argv)
{
    (void)argc;
    (void)argv;
    const int result = ggwave_transport_self_test();
    printf("ggwave_self_test=%d\n", result);
    return result == 0 ? 0 : 1;
}

static int cmd_diag(int argc, char **argv)
{
    (void)argc;
    (void)argv;
    const int mic_result = cmd_mic(0, NULL);
    ggwave_transport_log_status();
    return mic_result;
}

static int cmd_rx(int argc, char **argv)
{
    const int seconds = argc == 1 ? 10 : atoi(argv[1]);
    if (argc > 2 || seconds <= 0 || seconds > 60) {
        printf("usage: rx [seconds 1-60]\n");
        return 1;
    }

    static int32_t raw_samples[512];
    static int16_t samples[512];
    static uint8_t payload[256];
    int64_t raw_peak = 0;
    int64_t pcm_peak = 0;
    const int64_t deadline = esp_timer_get_time() + (int64_t)seconds * 1000000;
    printf("listening for %d seconds...\n", seconds);
    while (esp_timer_get_time() < deadline) {
        size_t samples_read = 0;
        const esp_err_t result = hardware_read_mic(raw_samples, 512, &samples_read, 500);
        if (result != ESP_OK) {
            printf("microphone read failed: %s\n", esp_err_to_name(result));
            return 1;
        }
        for (size_t index = 0; index < samples_read; index++) {
            int64_t raw_value = raw_samples[index] < 0 ? -(int64_t)raw_samples[index] : raw_samples[index];
            if (raw_value > raw_peak) raw_peak = raw_value;
            samples[index] = mic_sample_to_pcm(raw_samples[index]);
            int64_t value = samples[index] < 0 ? -(int64_t)samples[index] : samples[index];
            if (value > pcm_peak) pcm_peak = value;
        }

        const int decoded = ggwave_transport_decode(samples, samples_read, payload, sizeof(payload));
        if (decoded > 0) {
            char decoded_text[257] = {0};
            const int text_length = decoded < (int)sizeof(decoded_text) - 1 ? decoded : (int)sizeof(decoded_text) - 1;
            for (int index = 0; index < text_length; index++) {
                decoded_text[index] = (payload[index] >= 32 && payload[index] <= 126)
                    ? (char)payload[index]
                    : '.';
            }
            printf("received %d bytes text=\"%s\" hex=", decoded, decoded_text);
            for (int index = 0; index < decoded; index++) printf("%02x", payload[index]);
            printf("\n");
            (void)display_text(decoded_text);
            ggwave_transport_log_status();
            return 0;
        }
    }

    printf("no payload received raw_peak=%lld pcm_peak=%lld\n",
           (long long)raw_peak, (long long)pcm_peak);
    ggwave_transport_log_status();
    return 1;
}

static void init_console(void)
{
    const esp_console_cmd_t tone_command = {
        .command = "tone",
        .help = "play a one-second tone and sample the microphone",
        .hint = NULL,
        .func = &cmd_tone,
    };
    const esp_console_cmd_t mic_command = {
        .command = "mic",
        .help = "read microphone samples and peak level",
        .hint = NULL,
        .func = &cmd_mic,
    };
    const esp_console_cmd_t micplay_command = {
        .command = "micplay",
        .help = "record the microphone, then play it back",
        .hint = "[seconds]",
        .func = &cmd_micplay,
    };
    const esp_console_cmd_t oled_command = {
        .command = "oled",
        .help = "redraw OLED test pattern",
        .hint = NULL,
        .func = &cmd_oled,
    };
    const esp_console_cmd_t screen_command = {
        .command = "screen",
        .help = "display typed text on the OLED",
        .hint = "<text>",
        .func = &cmd_screen,
    };
    const esp_console_cmd_t tx_command = {
        .command = "tx",
        .help = "transmit a text payload over audio",
        .hint = NULL,
        .func = &cmd_tx,
    };
    const esp_console_cmd_t ggtest_command = {
        .command = "ggtest",
        .help = "encode and decode a ggwave waveform in memory",
        .hint = NULL,
        .func = &cmd_ggtest,
    };
    const esp_console_cmd_t diag_command = {
        .command = "diag",
        .help = "print microphone and ggwave diagnostics",
        .hint = NULL,
        .func = &cmd_diag,
    };
    const esp_console_cmd_t api_command = {
        .command = "api",
        .help = "send a structured JSON device request",
        .hint = "<json>",
        .func = &device_api_command,
    };
    const esp_console_cmd_t acoustic_command = {
        .command = "acoustic",
        .help = "capture the speaker waveform and run it through ggwave",
        .hint = NULL,
        .func = &cmd_acoustic,
    };
    const esp_console_cmd_t rx_command = {
        .command = "rx",
        .help = "listen for an audio payload",
        .hint = "[seconds]",
        .func = &cmd_rx,
    };

    ESP_ERROR_CHECK(esp_console_register_help_command());
    ESP_ERROR_CHECK(esp_console_cmd_register(&tone_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&mic_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&micplay_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&oled_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&screen_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&tx_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&ggtest_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&diag_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&api_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&acoustic_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&rx_command));

    esp_console_repl_t *repl = NULL;
    esp_console_repl_config_t repl_config = ESP_CONSOLE_REPL_CONFIG_DEFAULT();
    repl_config.prompt = "melodypay> ";
    repl_config.task_stack_size = 8192;
    esp_console_dev_uart_config_t uart_config = ESP_CONSOLE_DEV_UART_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_console_new_repl_uart(&uart_config, &repl_config, &repl));
    ESP_ERROR_CHECK(esp_console_start_repl(repl));
}

void app_main(void)
{
    ESP_ERROR_CHECK(nvs_flash_init());
    ESP_ERROR_CHECK(hardware_init());
    ESP_ERROR_CHECK(ggwave_transport_init());
    ESP_ERROR_CHECK(display_init());
    ESP_ERROR_CHECK(keystore_init());
    wallet_state_init();

    display_message("MelodyPay", "Audio ready", "Development backend", "USB diagnostics");
    ESP_LOGI(TAG, "OLED connected: %s", display_is_connected() ? "yes" : "no");
    ESP_LOGI(TAG, "audio self-test result: %s", esp_err_to_name(hardware_run_audio_self_test()));
    ESP_LOGI(TAG, "wallet state initialized: %d", wallet_state_get());
    init_console();

    while (true) {
        vTaskDelay(pdMS_TO_TICKS(50));
    }
}
