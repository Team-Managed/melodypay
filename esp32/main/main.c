#include "display.h"
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
    int64_t peak = 0;
    for (size_t index = 0; index < count; index++) {
        int64_t value = samples[index] < 0 ? -(int64_t)samples[index] : samples[index];
        if (value > peak) peak = value;
    }
    printf("result=%s samples=%u peak=%lld\n", esp_err_to_name(result), (unsigned)count, (long long)peak);
    return result == ESP_OK ? 0 : 1;
}

static int cmd_oled(int argc, char **argv)
{
    (void)argc;
    (void)argv;
    esp_err_t result = display_test_pattern();
    printf("oled_connected=%s pattern_result=%s\n", display_is_connected() ? "yes" : "no", esp_err_to_name(result));
    return result == ESP_OK ? 0 : 1;
}

static int cmd_tx(int argc, char **argv)
{
    if (argc != 2) {
        printf("usage: tx <payload>\n");
        return 1;
    }

    const uint8_t *payload = (const uint8_t *)argv[1];
    const size_t payload_size = strlen(argv[1]);
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

    printf("transmitting %u bytes as %d samples...\n", (unsigned)payload_size, encoded_samples);
    hardware_mute_mic();
    esp_err_t result = hardware_play_pcm(waveform, (size_t)encoded_samples);
    if (result == ESP_OK) result = hardware_stop_pcm();
    hardware_unmute_mic();
    heap_caps_free(waveform);
    printf("result=%s\n", esp_err_to_name(result));
    return result == ESP_OK ? 0 : 1;
}

static int cmd_rx(int argc, char **argv)
{
    const int seconds = argc == 1 ? 10 : atoi(argv[1]);
    if (argc > 2 || seconds <= 0 || seconds > 60) {
        printf("usage: rx [seconds 1-60]\n");
        return 1;
    }

    int32_t raw_samples[256];
    int16_t samples[256];
    uint8_t payload[256];
    const int64_t deadline = esp_timer_get_time() + (int64_t)seconds * 1000000;
    printf("listening for %d seconds...\n", seconds);
    while (esp_timer_get_time() < deadline) {
        size_t samples_read = 0;
        const esp_err_t result = hardware_read_mic(raw_samples, 256, &samples_read, 500);
        if (result != ESP_OK) {
            printf("microphone read failed: %s\n", esp_err_to_name(result));
            return 1;
        }
        for (size_t index = 0; index < samples_read; index++) samples[index] = (int16_t)(raw_samples[index] >> 11);

        const int decoded = ggwave_transport_decode(samples, samples_read, payload, sizeof(payload));
        if (decoded > 0) {
            printf("received %d bytes: ", decoded);
            for (int index = 0; index < decoded; index++) printf("%02x", payload[index]);
            printf("\n");
            return 0;
        }
    }

    printf("no payload received\n");
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
    const esp_console_cmd_t oled_command = {
        .command = "oled",
        .help = "redraw OLED test pattern",
        .hint = NULL,
        .func = &cmd_oled,
    };
    const esp_console_cmd_t tx_command = {
        .command = "tx",
        .help = "transmit a text payload over audio",
        .hint = NULL,
        .func = &cmd_tx,
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
    ESP_ERROR_CHECK(esp_console_cmd_register(&oled_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&tx_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&rx_command));

    esp_console_repl_t *repl = NULL;
    esp_console_repl_config_t repl_config = ESP_CONSOLE_REPL_CONFIG_DEFAULT();
    repl_config.prompt = "melodypay> ";
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
