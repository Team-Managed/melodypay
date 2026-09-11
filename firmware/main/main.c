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

    display_message("MelodyPay", "Wallet ready", "Development backend", "Awaiting audio");
    ESP_LOGI(TAG, "wallet state initialized: %d", wallet_state_get());

    while (true) {
        if (hardware_reject_pressed()) {
            wallet_state_set(WALLET_IDLE);
            display_message("Rejected", "No signature", "", "");
        }
        vTaskDelay(pdMS_TO_TICKS(50));
    }
}
