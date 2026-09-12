#pragma once

#include "esp_err.h"
#include <stdbool.h>
#include <stdint.h>

#define MELODY_APPROVAL_BUTTON_GPIO 10
#define MELODY_BUTTON_DOUBLE_CLICK_MS 400

typedef enum {
    BUTTON_EVENT_NONE = 0,
    BUTTON_EVENT_SINGLE_CLICK,
    BUTTON_EVENT_DOUBLE_CLICK,
} button_event_t;

esp_err_t button_init(void);
bool button_is_pressed(void);
esp_err_t button_wait_for_approval(uint32_t timeout_ms);
button_event_t button_poll_event(void);
