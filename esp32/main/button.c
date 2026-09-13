#include "button.h"

#include "driver/gpio.h"
#include "esp_check.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "button";
static bool initialized;
static bool stable_pressed;
static bool click_pending;
static int64_t first_click_us;
static int64_t last_transition_us;

esp_err_t button_init(void)
{
    const gpio_config_t config = {
        .pin_bit_mask = 1ULL << MELODY_APPROVAL_BUTTON_GPIO,
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    ESP_RETURN_ON_ERROR(gpio_config(&config), TAG, "GPIO10 config failed");
    initialized = true;
    stable_pressed = false;
    click_pending = false;
    first_click_us = 0;
    last_transition_us = esp_timer_get_time();
    ESP_LOGI(TAG, "approval button configured on GPIO%d active_low=true", MELODY_APPROVAL_BUTTON_GPIO);
    return ESP_OK;
}

button_event_t button_poll_event(void)
{
    if (!initialized) return BUTTON_EVENT_NONE;
    const int64_t now = esp_timer_get_time();
    const bool pressed = button_is_pressed();
    if (pressed != stable_pressed && now - last_transition_us >= 30000) {
        last_transition_us = now;
        stable_pressed = pressed;
        if (pressed) {
            if (click_pending && now - first_click_us <= (int64_t)MELODY_BUTTON_DOUBLE_CLICK_MS * 1000) {
                click_pending = false;
                return BUTTON_EVENT_DOUBLE_CLICK;
            }
            click_pending = true;
            first_click_us = now;
        }
    }
    if (click_pending && now - first_click_us > (int64_t)MELODY_BUTTON_DOUBLE_CLICK_MS * 1000) {
        click_pending = false;
        return BUTTON_EVENT_SINGLE_CLICK;
    }
    return BUTTON_EVENT_NONE;
}

esp_err_t button_wait_for_release(uint32_t timeout_ms)
{
    if (!initialized) return ESP_ERR_INVALID_STATE;
    const int64_t deadline = esp_timer_get_time() + (int64_t)timeout_ms * 1000;
    while (button_is_pressed() && esp_timer_get_time() < deadline) {
        vTaskDelay(pdMS_TO_TICKS(10));
    }
    return button_is_pressed() ? ESP_ERR_TIMEOUT : ESP_OK;
}

bool button_is_pressed(void)
{
    return initialized && gpio_get_level(MELODY_APPROVAL_BUTTON_GPIO) == 0;
}

esp_err_t button_wait_for_approval(uint32_t timeout_ms)
{
    if (!initialized) return ESP_ERR_INVALID_STATE;
    if (timeout_ms == 0) return ESP_ERR_TIMEOUT;

    const int64_t deadline = esp_timer_get_time() + (int64_t)timeout_ms * 1000;
    bool released = !button_is_pressed();
    while (esp_timer_get_time() < deadline) {
        if (!released) {
            released = !button_is_pressed();
        } else if (button_is_pressed()) {
            vTaskDelay(pdMS_TO_TICKS(30));
            if (button_is_pressed()) return ESP_OK;
        }
        vTaskDelay(pdMS_TO_TICKS(10));
    }
    return ESP_ERR_TIMEOUT;
}
