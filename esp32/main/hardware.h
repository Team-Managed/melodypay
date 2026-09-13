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

esp_err_t hardware_init(void);
esp_err_t hardware_read_mic(int32_t *samples, size_t sample_count, size_t *samples_read, uint32_t timeout_ms);
esp_err_t hardware_play_pcm(const int16_t *samples, size_t sample_count);
typedef bool (*hardware_cancel_fn_t)(void *context);
esp_err_t hardware_play_pcm_interruptible(const int16_t *samples, size_t sample_count,
                                          hardware_cancel_fn_t should_cancel, void *context);
esp_err_t hardware_stop_pcm(void);
esp_err_t hardware_run_audio_self_test(void);
esp_err_t hardware_play_boot_chime(void);
esp_err_t hardware_play_feedback(bool confirm);
esp_err_t hardware_play_success_chime(void);
void hardware_mute_mic(void);
void hardware_unmute_mic(void);
