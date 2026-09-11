#pragma once

#include "esp_err.h"

esp_err_t display_init(void);
void display_message(const char *line1, const char *line2, const char *line3, const char *line4);
