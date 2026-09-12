#include "display.h"
#include "hardware.h"
#include "keystore.h"
#include "wallet_state.h"

#include "nvs_flash.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_console.h"
#include <stdio.h>

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

    ESP_ERROR_CHECK(esp_console_register_help_command());
    ESP_ERROR_CHECK(esp_console_cmd_register(&tone_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&mic_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&oled_command));

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
