#pragma once

#include "esp_err.h"
#include <stdbool.h>
#include <stdint.h>

esp_err_t display_init(void);
bool display_is_connected(void);
esp_err_t display_test_pattern(void);
esp_err_t display_text(const char *text);
void display_message(const char *line1, const char *line2, const char *line3, const char *line4);
void display_boot_animation(void);
void display_home_screen(uint8_t selection);
void display_menu_screen(uint8_t selection);
void display_payment_screen(void);
void display_receive_screen(void);
