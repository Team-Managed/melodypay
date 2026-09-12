#pragma once

#include "driver/i2s_std.h"
#include "esp_err.h"
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define MELODY_SAMPLE_RATE 48000
#define MELODY_MIC_BCLK_GPIO 4
#define MELODY_MIC_WS_GPIO 5
#define MELODY_MIC_DATA_GPIO 6
#define MELODY_AMP_BCLK_GPIO 15
#define MELODY_AMP_LRC_GPIO 16
#define MELODY_AMP_DATA_GPIO 7
#define MELODY_OLED_SDA_GPIO 8
#define MELODY_OLED_SCL_GPIO 9
#define MELODY_APPROVE_GPIO 17
#define MELODY_REJECT_GPIO 18

esp_err_t hardware_init(void);
bool hardware_audio_available(void);
esp_err_t hardware_read_mic(int32_t *samples, size_t sample_count, size_t *samples_read, uint32_t timeout_ms);
esp_err_t hardware_play_pcm(const int16_t *samples, size_t sample_count);
void hardware_mute_mic(void);
void hardware_unmute_mic(void);
bool hardware_approve_pressed(void);
bool hardware_reject_pressed(void);
