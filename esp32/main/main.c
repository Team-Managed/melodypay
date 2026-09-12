#include "display.h"
#include "hardware.h"
#include "keystore.h"
#include "wallet_state.h"

#include "nvs_flash.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "melodypay";

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

    bool previous_approve = false;
    bool previous_reject = false;
    while (true) {
        const bool approve = hardware_approve_pressed();
        const bool reject = hardware_reject_pressed();
        if (approve && !previous_approve) {
            ESP_LOGI(TAG, "approve button pressed");
        }
        if (reject && !previous_reject) {
            wallet_state_set(WALLET_IDLE);
            display_message("Rejected", "No signature", "", "");
            ESP_LOGI(TAG, "reject button pressed");
        }
        previous_approve = approve;
        previous_reject = reject;
        vTaskDelay(pdMS_TO_TICKS(50));
    }
}
