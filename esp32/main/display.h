#pragma once

#include "esp_err.h"
#include <stdbool.h>

esp_err_t display_init(void);
bool display_is_connected(void);
esp_err_t display_test_pattern(void);
void display_message(const char *line1, const char *line2, const char *line3, const char *line4);
