#include "display.h"
#include "device_api.h"
#include "button.h"
#include "ggwave_transport.h"
#include "hardware.h"
#include "keystore.h"
#include "evm_tx.h"
#include "wallet_state.h"

#include "nvs_flash.h"
#include "esp_log.h"
#include "esp_system.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_console.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "esp_heap_caps.h"

static const char *TAG = "melodypay";
static int16_t mic_sample_to_pcm(int32_t raw);
static esp_err_t listen_audio_text(char *output, size_t capacity, uint32_t timeout_ms);

typedef enum {
    UI_HOME = 0,
    UI_MENU,
    UI_PAYMENT,
    UI_RECEIVE,
    UI_PAYMENT_MENU,
} ui_screen_t;

static ui_screen_t ui_screen = UI_HOME;
static uint8_t ui_selection;
static volatile bool boot_audio_running;
static volatile bool boot_audio_done;
static uint8_t pending_signed_transaction[256];
static size_t pending_signed_length;
static char pending_amount[32];
static char pending_symbol[16];
static char pending_address[43];
static volatile bool success_audio_running;
static volatile bool success_audio_done;
static volatile uint8_t success_audio_phase;

static void success_chime_task(void *argument)
{
    (void)argument;
    while (success_audio_running) {
        if (success_audio_phase == 1) (void)hardware_play_warp_chime();
        else (void)hardware_play_check_chime();
    }
    success_audio_done = true;
    vTaskDelete(NULL);
}

static void show_payment_success(void)
{
    success_audio_running = true;
    success_audio_done = false;
    success_audio_phase = 1;
    if (xTaskCreate(success_chime_task, "success_chime", 3072, NULL, 4, NULL) != pdPASS) {
        success_audio_running = false;
        success_audio_done = true;
    }
    display_success_warp_animation();
    success_audio_phase = 2;
    display_success_check_animation();
    success_audio_running = false;
    while (!success_audio_done) vTaskDelay(pdMS_TO_TICKS(10));
    display_success_screen(pending_amount, pending_symbol, pending_address);
    vTaskDelay(pdMS_TO_TICKS(2500));
}

static void bytes_to_hex(const uint8_t *bytes, size_t length, char *output)
{
    static const char hex[] = "0123456789abcdef";
    for (size_t index = 0; index < length; index++) {
        output[index * 2] = hex[bytes[index] >> 4];
        output[index * 2 + 1] = hex[bytes[index] & 0x0f];
    }
    output[length * 2] = '\0';
}

static bool decimal_to_units(const char *text, uint8_t scale, uint8_t output[32])
{
    memset(output, 0, 32);
    uint8_t fractional_digits = 0;
    bool decimal_seen = false;
    bool digit_seen = false;
    for (const char *cursor = text; *cursor != '\0'; cursor++) {
        if (*cursor == '.') {
            if (decimal_seen) return false;
            decimal_seen = true;
            continue;
        }
        if (*cursor < '0' || *cursor > '9') return false;
        if (decimal_seen && ++fractional_digits > scale) return false;
        digit_seen = true;
        uint16_t carry = (uint16_t)(*cursor - '0');
        for (int index = 31; index >= 0; index--) {
            const uint16_t value = (uint16_t)output[index] * 10 + carry;
            output[index] = (uint8_t)value;
            carry = value >> 8;
        }
        if (carry != 0) return false;
    }
    if (!digit_seen) return false;
    for (uint8_t padding = fractional_digits; padding < scale; padding++) {
        uint16_t carry = 0;
        for (int index = 31; index >= 0; index--) {
            const uint16_t value = (uint16_t)output[index] * 10 + carry;
            output[index] = (uint8_t)value;
            carry = value >> 8;
        }
        if (carry != 0) return false;
    }
    return true;
}

static esp_err_t send_audio_text(const char *text)
{
    const size_t length = strlen(text);
    if (length == 0 || length >= GGWAVE_TRANSPORT_PAYLOAD_BYTES) return ESP_ERR_INVALID_SIZE;
    const size_t sample_count = ggwave_transport_encode_size((const uint8_t *)text, length);
    if (sample_count == 0) return ESP_FAIL;
    int16_t *samples = heap_caps_malloc(sample_count * sizeof(int16_t), MALLOC_CAP_8BIT);
    if (samples == NULL) return ESP_ERR_NO_MEM;
    const int encoded = ggwave_transport_encode((const uint8_t *)text, length, samples, sample_count);
    esp_err_t result = encoded > 0 ? hardware_play_pcm(samples, (size_t)encoded) : ESP_FAIL;
    if (result == ESP_OK) result = hardware_stop_pcm();
    heap_caps_free(samples);
    return result;
}

static esp_err_t transmit_pending_signed_transaction(void)
{
    if (pending_signed_length == 0) return ESP_ERR_INVALID_STATE;
    char signed_hex[515];
    bytes_to_hex(pending_signed_transaction, pending_signed_length, signed_hex + 2);
    signed_hex[0] = '0';
    signed_hex[1] = 'x';
    const size_t chunk_size = 48;
    const size_t total = (strlen(signed_hex) + chunk_size - 1) / chunk_size;
    esp_err_t result = ESP_OK;
    for (size_t index = 0; index < total; index++) {
        char chunk[GGWAVE_TRANSPORT_PAYLOAD_BYTES];
        snprintf(chunk, sizeof(chunk), "TX%u/%u|%.*s", (unsigned)(index + 1), (unsigned)total,
                 (int)chunk_size, signed_hex + index * chunk_size);
        result = send_audio_text(chunk);
        if (result != ESP_OK) break;
        vTaskDelay(pdMS_TO_TICKS(150));
    }
    memset(signed_hex, 0, sizeof(signed_hex));
    return result;
}

static esp_err_t wait_for_payment_receipt(void)
{
    display_payment_menu_screen(0);
    char receipt[128] = {0};
    esp_err_t result = listen_audio_text(receipt, sizeof(receipt), 60000);
    if (result == ESP_ERR_TIMEOUT) return ESP_ERR_INVALID_STATE;
    if (result != ESP_OK || strncmp(receipt, "RECEIPT|", 8) != 0) return result == ESP_OK ? ESP_ERR_INVALID_RESPONSE : result;
    memset(pending_signed_transaction, 0, sizeof(pending_signed_transaction));
    pending_signed_length = 0;
    wallet_state_set(WALLET_IDLE);
    show_payment_success();
    return ESP_OK;
}

static esp_err_t listen_audio_text(char *output, size_t capacity, uint32_t timeout_ms)
{
    static int32_t raw_samples[512];
    static int16_t samples[512];
    static uint8_t payload[GGWAVE_TRANSPORT_PAYLOAD_BYTES];
    char assembled[256] = {0};
    size_t assembled_length = 0;
    unsigned expected_chunk = 0;
    unsigned total_chunks = 0;
    const int64_t deadline = esp_timer_get_time() + (int64_t)timeout_ms * 1000;
    while (esp_timer_get_time() < deadline) {
        if (button_is_pressed()) return ESP_ERR_INVALID_STATE;
        if (button_poll_event() != BUTTON_EVENT_NONE) return ESP_ERR_INVALID_STATE;
        size_t sample_count = 0;
        if (hardware_read_mic(raw_samples, 512, &sample_count, 100) != ESP_OK) continue;
        for (size_t index = 0; index < sample_count; index++) samples[index] = mic_sample_to_pcm(raw_samples[index]);
        const int decoded = ggwave_transport_decode(samples, sample_count, payload, sizeof(payload));
        if (decoded > 0) {
            payload[decoded] = '\0';
            unsigned chunk = 0;
            unsigned total = 0;
            int prefix_length = 0;
            if (sscanf((char *)payload, "TX%u/%u|%n", &chunk, &total, &prefix_length) == 2) {
                if (total == 0 || total > 16 || chunk != expected_chunk + 1 ||
                    assembled_length + (size_t)decoded - (size_t)prefix_length >= sizeof(assembled)) {
                    assembled_length = 0;
                    expected_chunk = 0;
                    total_chunks = 0;
                    continue;
                }
                if (total_chunks == 0) total_chunks = total;
                if (total != total_chunks) continue;
                memcpy(assembled + assembled_length, payload + prefix_length, (size_t)decoded - (size_t)prefix_length);
                assembled_length += (size_t)decoded - (size_t)prefix_length;
                expected_chunk = chunk;
                if (expected_chunk == total_chunks) {
                    if (assembled_length >= capacity) return ESP_ERR_INVALID_SIZE;
                    memcpy(output, assembled, assembled_length);
                    output[assembled_length] = '\0';
                    return ESP_OK;
                }
                continue;
            }
            if ((size_t)decoded < capacity) {
                memcpy(output, payload, (size_t)decoded);
                output[decoded] = '\0';
                return ESP_OK;
            }
        }
    }
    return ESP_ERR_TIMEOUT;
}

static esp_err_t run_hardware_payment_sender(void)
{
    uint8_t address[20];
    char address_hex[43];
    esp_err_t result = keystore_get_address(address);
    if (result != ESP_OK) return result;
    bytes_to_hex(address, sizeof(address), address_hex + 2);
    address_hex[0] = '0';
    address_hex[1] = 'x';
    char address_message[64];
    snprintf(address_message, sizeof(address_message), "ADDR|%s", address_hex);
    display_payment_screen();
    wallet_state_set(WALLET_RECEIVING);
    result = send_audio_text(address_message);
    if (result != ESP_OK) return result;
    display_payment_menu_screen(0);
    char request[GGWAVE_TRANSPORT_PAYLOAD_BYTES] = {0};
    result = listen_audio_text(request, sizeof(request), 60000);
    if (result != ESP_OK) return result;
    char *fields[12] = {0};
    size_t field_count = 0;
    for (char *field = strtok(request, "|"); field != NULL && field_count < 12; field = strtok(NULL, "|")) {
        fields[field_count++] = field;
    }
    const bool pay2 = field_count > 0 && strcmp(fields[0], "PAY2") == 0;
    if ((!pay2 && (field_count != 4 || strcmp(fields[0], "PAY") != 0)) || (pay2 && field_count != 10)) {
        return ESP_ERR_INVALID_RESPONSE;
    }
    const char *recipient = pay2 ? fields[2] : fields[1];
    const char *amount = pay2 ? fields[3] : fields[2];
    const char *nonce_text = pay2 ? fields[4] : fields[3];
    if (strlen(recipient) != 42 || recipient[0] != '0' || recipient[1] != 'x') return ESP_ERR_INVALID_ARG;
    uint8_t recipient_bytes[20];
    for (size_t index = 0; index < 20; index++) {
        const char high = recipient[index * 2 + 2];
        const char low = recipient[index * 2 + 3];
        const int high_value = high <= '9' ? high - '0' : (high | 0x20) - 'a' + 10;
        const int low_value = low <= '9' ? low - '0' : (low | 0x20) - 'a' + 10;
        if (high_value < 0 || high_value > 15 || low_value < 0 || low_value > 15) return ESP_ERR_INVALID_ARG;
        recipient_bytes[index] = (uint8_t)((high_value << 4) | low_value);
    }
    uint8_t value[32];
    if (!decimal_to_units(amount, 18, value)) return ESP_ERR_INVALID_ARG;
    char *end = NULL;
    const uint64_t nonce = strtoull(nonce_text, &end, 10);
    if (end == nonce_text || *end != '\0') return ESP_ERR_INVALID_ARG;
    evm_native_transfer_t transfer = {0};
    if (pay2) {
        end = NULL;
        transfer.chain_id = strtoull(fields[1], &end, 10);
        if (end == fields[1] || *end != '\0') return ESP_ERR_INVALID_ARG;
    } else {
        transfer.chain_id = 10143;
    }
    transfer.nonce = nonce;
    if (pay2) {
        end = NULL;
        const unsigned long gas_limit = strtoul(fields[9], &end, 10);
        if (end == fields[9] || *end != '\0' || gas_limit > UINT32_MAX) return ESP_ERR_INVALID_ARG;
        transfer.gas_limit = (uint32_t)gas_limit;
    } else {
        transfer.gas_limit = 21000;
    }
    memcpy(transfer.recipient, recipient_bytes, sizeof(recipient_bytes));
    memcpy(transfer.value, value, sizeof(value));
    snprintf(pending_amount, sizeof(pending_amount), "%s", amount);
    snprintf(pending_symbol, sizeof(pending_symbol), "%s",
             evm_chain_symbol(transfer.chain_id) != NULL ? evm_chain_symbol(transfer.chain_id) : "TOKEN");
    snprintf(pending_address, sizeof(pending_address), "%s", address_hex);
    if (pay2) {
        if (!decimal_to_units(fields[8], 9, transfer.max_priority_fee_per_gas) ||
            !decimal_to_units(fields[7], 9, transfer.max_fee_per_gas)) return ESP_ERR_INVALID_ARG;
    } else {
        transfer.max_priority_fee_per_gas[28] = 0x77;
        transfer.max_priority_fee_per_gas[29] = 0x35;
        transfer.max_priority_fee_per_gas[30] = 0x94;
        transfer.max_priority_fee_per_gas[31] = 0x00;
        transfer.max_fee_per_gas[27] = 0x22;
        transfer.max_fee_per_gas[28] = 0xec;
        transfer.max_fee_per_gas[29] = 0xb2;
        transfer.max_fee_per_gas[30] = 0x5c;
        transfer.max_fee_per_gas[31] = 0x00;
    }
    wallet_state_set(WALLET_REVIEW);
    char recipient_preview[24];
    char amount_display[32];
    char countdown[16];
    snprintf(recipient_preview, sizeof(recipient_preview), "TO %.8s...", recipient);
    snprintf(amount_display, sizeof(amount_display), "%s %s", amount,
             evm_chain_symbol(transfer.chain_id) != NULL ? evm_chain_symbol(transfer.chain_id) : "TOKEN");
    result = ESP_ERR_TIMEOUT;
    for (uint32_t remaining = 15; remaining > 0; remaining--) {
        snprintf(countdown, sizeof(countdown), "%02u", (unsigned)remaining);
        display_message("PAYMENT", amount_display, recipient_preview, countdown);
        result = button_wait_for_approval(1000);
        if (result == ESP_OK) break;
        if (result != ESP_ERR_TIMEOUT) return result;
    }
    if (result != ESP_OK) return result;
    ESP_LOGI(TAG, "payment approval accepted; signing transaction");
    wallet_state_set(WALLET_TRANSMITTING);
    uint8_t signed_transaction[256];
    size_t signed_length = 0;
    result = evm_sign_eip1559(&transfer, signed_transaction, sizeof(signed_transaction), &signed_length);
    if (result != ESP_OK) return result;
    ESP_LOGI(TAG, "transaction signed; transmitting %u bytes", (unsigned)signed_length);
    memcpy(pending_signed_transaction, signed_transaction, signed_length);
    pending_signed_length = signed_length;
    memset(signed_transaction, 0, sizeof(signed_transaction));
    result = transmit_pending_signed_transaction();
    if (result != ESP_OK) return result;
    return wait_for_payment_receipt();
}

static void boot_chime_task(void *argument)
{
    (void)argument;
    while (boot_audio_running) (void)hardware_play_boot_chime();
    boot_audio_done = true;
    vTaskDelete(NULL);
}

static void render_ui(void)
{
    if (ui_screen == UI_HOME) display_home_screen(ui_selection);
    if (ui_screen == UI_MENU) display_menu_screen(ui_selection);
    if (ui_screen == UI_PAYMENT) display_payment_screen();
    if (ui_screen == UI_PAYMENT_MENU) display_payment_menu_screen(ui_selection);
}

static void handle_ui_event(button_event_t event)
{
    if (event == BUTTON_EVENT_NONE) return;
    (void)hardware_play_feedback(event == BUTTON_EVENT_DOUBLE_CLICK);
    if (ui_screen == UI_HOME) {
        if (event == BUTTON_EVENT_SINGLE_CLICK) {
            ui_selection = (uint8_t)((ui_selection + 1) % 3);
            render_ui();
        } else if (ui_selection == 0) {
            ui_screen = UI_PAYMENT;
            if (button_wait_for_release(1000) != ESP_OK) {
                ui_screen = UI_HOME;
                ui_selection = 0;
                render_ui();
                return;
            }
            const esp_err_t payment_result = run_hardware_payment_sender();
            if (payment_result == ESP_ERR_INVALID_STATE) {
                (void)button_wait_for_release(1000);
                button_reset_event_state();
                ui_screen = UI_PAYMENT_MENU;
                ui_selection = 0;
                display_payment_menu_screen(0);
                return;
            }
            if (payment_result != ESP_OK) {
                display_message("PAYMENT", "Flow stopped", esp_err_to_name(payment_result), "");
                vTaskDelay(pdMS_TO_TICKS(1200));
            }
            ui_screen = UI_HOME;
            ui_selection = 0;
            wallet_state_set(WALLET_IDLE);
            render_ui();
        } else if (ui_selection == 1) {
            ui_screen = UI_RECEIVE;
            wallet_state_set(WALLET_RECEIVING);
            display_receive_screen();
        } else {
            ui_screen = UI_MENU;
            ui_selection = 0;
            render_ui();
        }
        return;
    }

    if (ui_screen == UI_MENU) {
        if (event == BUTTON_EVENT_SINGLE_CLICK) {
            ui_selection = (uint8_t)((ui_selection + 1) % 4);
            render_ui();
        } else if (ui_selection == 0) {
            display_message("STATUS", keystore_is_ready() ? "Signer ready" : "Signer off",
                            display_is_connected() ? "OLED ready" : "OLED off", "*   *   *");
            vTaskDelay(pdMS_TO_TICKS(900));
            render_ui();
        } else if (ui_selection == 1) {
            display_message("NETWORK", "Monad testnet", "Ethereum Sepolia", "");
            vTaskDelay(pdMS_TO_TICKS(900));
            render_ui();
        } else if (ui_selection == 2) {
            display_message("REBOOT", "Restarting...", "MelodyPay", "");
            (void)hardware_play_feedback(true);
            vTaskDelay(pdMS_TO_TICKS(500));
            esp_restart();
        } else {
            ui_screen = UI_HOME;
            ui_selection = 0;
            render_ui();
        }
        return;
    }

    if (ui_screen == UI_RECEIVE &&
        (event == BUTTON_EVENT_SINGLE_CLICK || event == BUTTON_EVENT_DOUBLE_CLICK)) {
        ui_screen = UI_HOME;
        ui_selection = 0;
        wallet_state_set(WALLET_IDLE);
        render_ui();
        return;
    }

    if (ui_screen == UI_PAYMENT && event == BUTTON_EVENT_DOUBLE_CLICK) {
        ui_screen = UI_HOME;
        ui_selection = 0;
        wallet_state_set(WALLET_IDLE);
        render_ui();
        return;
    }

    if (ui_screen == UI_PAYMENT_MENU) {
        if (event == BUTTON_EVENT_SINGLE_CLICK) {
            ui_selection = (uint8_t)((ui_selection + 1) % 2);
            render_ui();
        } else if (ui_selection == 0) {
            if (button_wait_for_release(1000) == ESP_OK) {
                const esp_err_t result = pending_signed_length > 0
                    ? (wallet_state_set(WALLET_TRANSMITTING), transmit_pending_signed_transaction())
                    : ESP_ERR_INVALID_STATE;
                if (result == ESP_ERR_INVALID_STATE) {
                    (void)button_wait_for_release(1000);
                    button_reset_event_state();
                    ui_screen = UI_PAYMENT_MENU;
                    ui_selection = 0;
                    display_payment_menu_screen(0);
                    return;
                }
                if (result == ESP_OK) {
                    const esp_err_t receipt_result = wait_for_payment_receipt();
                    if (receipt_result == ESP_ERR_INVALID_STATE) {
                        (void)button_wait_for_release(1000);
                        button_reset_event_state();
                        ui_screen = UI_PAYMENT_MENU;
                        ui_selection = 0;
                        display_payment_menu_screen(0);
                        return;
                    }
                }
            }
            ui_screen = UI_HOME;
            ui_selection = 0;
            wallet_state_set(WALLET_IDLE);
            render_ui();
        } else {
            ui_screen = UI_HOME;
            ui_selection = 0;
            memset(pending_signed_transaction, 0, sizeof(pending_signed_transaction));
            pending_signed_length = 0;
            wallet_state_set(WALLET_IDLE);
            render_ui();
        }
    }
}

static int16_t mic_sample_to_pcm(int32_t raw)
{
    int64_t value = (int64_t)raw >> 15;
    if (value > INT16_MAX) return INT16_MAX;
    if (value < INT16_MIN) return INT16_MIN;
    return (int16_t)value;
}

static int cmd_tone(int argc, char **argv)
{
    (void)argc;
    (void)argv;
    printf("running 1-second tone and microphone sample test...\n");
    printf("result=%s\n", esp_err_to_name(hardware_run_audio_self_test()));
    return 0;
}

static int cmd_button_test(int argc, char **argv)
{
    const int seconds = argc == 1 ? 10 : atoi(argv[1]);
    if (argc > 2 || seconds <= 0 || seconds > 60) {
        printf("usage: button_test [seconds 1-60]\n");
        return 1;
    }
    printf("press GPIO%d within %d seconds to approve...\n", MELODY_APPROVAL_BUTTON_GPIO, seconds);
    const esp_err_t result = button_wait_for_approval((uint32_t)seconds * 1000);
    printf("approval=%s result=%s\n",
           result == ESP_OK ? "approved" : "timeout",
           esp_err_to_name(result));
    return result == ESP_OK ? 0 : 1;
}

static int cmd_mic(int argc, char **argv)
{
    (void)argc;
    (void)argv;
    int32_t samples[256];
    size_t count = 0;
    esp_err_t result = hardware_read_mic(samples, 256, &count, 500);
    int64_t raw_peak = 0;
    int64_t pcm_peak = 0;
    int32_t raw_min = INT32_MAX;
    int32_t raw_max = INT32_MIN;
    int16_t pcm_min = INT16_MAX;
    int16_t pcm_max = INT16_MIN;
    for (size_t index = 0; index < count; index++) {
        if (samples[index] < raw_min) raw_min = samples[index];
        if (samples[index] > raw_max) raw_max = samples[index];
        int64_t value = samples[index] < 0 ? -(int64_t)samples[index] : samples[index];
        if (value > raw_peak) raw_peak = value;
        int16_t pcm = mic_sample_to_pcm(samples[index]);
        if (pcm < pcm_min) pcm_min = pcm;
        if (pcm > pcm_max) pcm_max = pcm;
        int64_t pcm_value = pcm < 0 ? -(int64_t)pcm : pcm;
        if (pcm_value > pcm_peak) pcm_peak = pcm_value;
    }
    printf("result=%s samples=%u raw_min=%ld raw_max=%ld pcm_min=%d pcm_max=%d raw_peak=%lld pcm_peak=%lld\n",
           esp_err_to_name(result), (unsigned)count, (long)raw_min, (long)raw_max,
           pcm_min, pcm_max, (long long)raw_peak, (long long)pcm_peak);
    return result == ESP_OK ? 0 : 1;
}

static int cmd_micplay(int argc, char **argv)
{
    const int seconds = argc == 1 ? 2 : atoi(argv[1]);
    if (argc > 2 || seconds <= 0 || seconds > 5) {
        printf("usage: micplay [seconds 1-5]\n");
        return 1;
    }

    const size_t capacity = (size_t)seconds * MELODY_SAMPLE_RATE;
    int16_t *recording = heap_caps_malloc(capacity * sizeof(int16_t), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (recording == NULL) recording = heap_caps_malloc(capacity * sizeof(int16_t), MALLOC_CAP_8BIT);
    if (recording == NULL) {
        printf("recording allocation failed for %u samples\n", (unsigned)capacity);
        return 1;
    }

    printf("recording microphone for %d seconds; speak near the INMP441...\n", seconds);
    size_t captured = 0;
    int64_t raw_peak = 0;
    int64_t pcm_peak = 0;
    while (captured < capacity) {
        int32_t raw[256];
        size_t read_count = 0;
        esp_err_t result = hardware_read_mic(raw, 256, &read_count, 500);
        if (result != ESP_OK) {
            printf("microphone read failed: %s\n", esp_err_to_name(result));
            heap_caps_free(recording);
            return 1;
        }
        const size_t remaining = capacity - captured;
        if (read_count > remaining) read_count = remaining;
        for (size_t index = 0; index < read_count; index++) {
            int64_t raw_value = raw[index] < 0 ? -(int64_t)raw[index] : raw[index];
            if (raw_value > raw_peak) raw_peak = raw_value;
            recording[captured + index] = mic_sample_to_pcm(raw[index]);
            int64_t pcm_value = recording[captured + index] < 0
                ? -(int64_t)recording[captured + index]
                : recording[captured + index];
            if (pcm_value > pcm_peak) pcm_peak = pcm_value;
        }
        captured += read_count;
    }

    printf("captured=%u raw_peak=%lld pcm_peak=%lld; playing recording...\n",
           (unsigned)captured, (long long)raw_peak, (long long)pcm_peak);
    hardware_mute_mic();
    esp_err_t result = hardware_play_pcm(recording, captured);
    if (result == ESP_OK) result = hardware_stop_pcm();
    hardware_unmute_mic();
    heap_caps_free(recording);
    printf("result=%s\n", esp_err_to_name(result));
    return result == ESP_OK ? 0 : 1;
}

typedef struct {
    int16_t *samples;
    size_t capacity;
    size_t count;
    volatile bool stop;
    volatile bool done;
    esp_err_t error;
} acoustic_capture_t;

static void acoustic_capture_task(void *argument)
{
    acoustic_capture_t *capture = (acoustic_capture_t *)argument;
    while (!capture->stop && capture->count < capture->capacity) {
        int32_t raw[256];
        size_t read_count = 0;
        capture->error = hardware_read_mic(raw, 256, &read_count, 100);
        if (capture->error != ESP_OK) break;
        size_t remaining = capture->capacity - capture->count;
        if (read_count > remaining) read_count = remaining;
        for (size_t index = 0; index < read_count; index++) {
            capture->samples[capture->count + index] = mic_sample_to_pcm(raw[index]);
        }
        capture->count += read_count;
    }
    capture->done = true;
    vTaskDelete(NULL);
}

static int cmd_acoustic(int argc, char **argv)
{
    (void)argc;
    (void)argv;
    static const uint8_t payload[] = {'h', 'e', 'l', 'l', 'o'};
    const size_t waveform_capacity = ggwave_transport_encode_size(payload, sizeof(payload));
    const size_t capture_capacity = MELODY_SAMPLE_RATE * 2;
    if (waveform_capacity == 0) {
        printf("acoustic encode initialization failed\n");
        return 1;
    }

    int16_t *waveform = heap_caps_malloc(waveform_capacity * sizeof(int16_t), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    int16_t *captured = heap_caps_malloc(capture_capacity * sizeof(int16_t), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (waveform == NULL || captured == NULL) {
        printf("acoustic buffer allocation failed\n");
        heap_caps_free(waveform);
        heap_caps_free(captured);
        return 1;
    }

    const int encoded_samples = ggwave_transport_encode(payload, sizeof(payload), waveform, waveform_capacity);
    if (encoded_samples <= 0) {
        printf("acoustic encode failed: %d\n", encoded_samples);
        heap_caps_free(waveform);
        heap_caps_free(captured);
        return 1;
    }

    acoustic_capture_t capture = {
        .samples = captured,
        .capacity = capture_capacity,
        .count = 0,
        .stop = false,
        .done = false,
        .error = ESP_OK,
    };
    if (xTaskCreate(acoustic_capture_task, "ggcap", 4096, &capture, 5, NULL) != pdPASS) {
        printf("acoustic capture task creation failed\n");
        heap_caps_free(waveform);
        heap_caps_free(captured);
        return 1;
    }

    vTaskDelay(pdMS_TO_TICKS(100));
    printf("acoustic loopback: playing %d samples while capturing...\n", encoded_samples);
    esp_err_t result = hardware_play_pcm(waveform, (size_t)encoded_samples);
    if (result == ESP_OK) result = hardware_stop_pcm();
    capture.stop = true;
    while (!capture.done) vTaskDelay(pdMS_TO_TICKS(10));

    uint8_t decoded_payload[256] = {0};
    int decoded = 0;
    for (size_t offset = 0; offset + 512 <= capture.count && decoded == 0; offset += 512) {
        size_t count = capture.count - offset;
        if (count > 512) count = 512;
        decoded = ggwave_transport_decode(captured + offset, count, decoded_payload, sizeof(decoded_payload));
    }
    printf("acoustic result=%s capture=%u decoded=%d capture_error=%s\n",
           esp_err_to_name(result), (unsigned)capture.count, decoded,
           esp_err_to_name(capture.error));
    ggwave_transport_log_status();
    heap_caps_free(waveform);
    heap_caps_free(captured);
    return decoded > 0 ? 0 : 1;
}

static int cmd_oled(int argc, char **argv)
{
    (void)argc;
    (void)argv;
    esp_err_t result = display_test_pattern();
    printf("oled_connected=%s pattern_result=%s\n", display_is_connected() ? "yes" : "no", esp_err_to_name(result));
    return result == ESP_OK ? 0 : 1;
}

static int cmd_oled_warp(int argc, char **argv)
{
    if (argc == 1) display_success_warp_animation();
    else display_success_warp_frame((uint8_t)atoi(argv[1]));
    return 0;
}

static int cmd_oled_check(int argc, char **argv)
{
    if (argc == 1) display_success_check_animation();
    else display_success_check_frame((uint8_t)atoi(argv[1]));
    return 0;
}

static int cmd_oled_success(int argc, char **argv)
{
    (void)argc;
    (void)argv;
    display_success_screen("0.01", "MON", "0x940b939cc85fdef41880b601467b9c40fdca22e5");
    return 0;
}

static int cmd_screen(int argc, char **argv)
{
    if (argc < 2) {
        printf("usage: screen <text>\n");
        return 1;
    }

    char text[256] = {0};
    size_t length = 0;
    for (int index = 1; index < argc && length + 1 < sizeof(text); index++) {
        if (index > 1 && length + 1 < sizeof(text)) text[length++] = ' ';
        const size_t remaining = sizeof(text) - length - 1;
        const size_t part_length = strlen(argv[index]);
        const size_t copied = part_length < remaining ? part_length : remaining;
        memcpy(text + length, argv[index], copied);
        length += copied;
    }

    esp_err_t result = display_text(text);
    printf("screen_result=%s text=%s\n", esp_err_to_name(result), text);
    return result == ESP_OK ? 0 : 1;
}

static int cmd_tx(int argc, char **argv)
{
    if (argc < 2) {
        printf("usage: tx <payload>\n");
        return 1;
    }

    char payload_text[64] = {0};
    size_t payload_size = 0;
    for (int index = 1; index < argc; index++) {
        if (index > 1) {
            if (payload_size + 1 >= sizeof(payload_text)) {
                printf("payload is too long; maximum is 63 bytes\n");
                return 1;
            }
            payload_text[payload_size++] = ' ';
        }
        const size_t part_length = strlen(argv[index]);
        if (payload_size + part_length >= sizeof(payload_text)) {
            printf("payload is too long; maximum is 63 bytes\n");
            return 1;
        }
        memcpy(payload_text + payload_size, argv[index], part_length);
        payload_size += part_length;
    }

    const uint8_t *payload = (const uint8_t *)payload_text;
    const size_t sample_count = ggwave_transport_encode_size(payload, payload_size);
    if (sample_count == 0) {
        printf("ggwave encode initialization failed\n");
        return 1;
    }

    int16_t *waveform = heap_caps_malloc(sample_count * sizeof(int16_t), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (waveform == NULL) waveform = heap_caps_malloc(sample_count * sizeof(int16_t), MALLOC_CAP_8BIT);
    if (waveform == NULL) {
        printf("waveform allocation failed for %u samples\n", (unsigned)sample_count);
        return 1;
    }

    const int encoded_samples = ggwave_transport_encode(payload, payload_size, waveform, sample_count);
    if (encoded_samples <= 0) {
        printf("ggwave encode failed: %d\n", encoded_samples);
        heap_caps_free(waveform);
        return 1;
    }

    int64_t waveform_peak = 0;
    for (int index = 0; index < encoded_samples; index++) {
        int64_t value = waveform[index] < 0 ? -(int64_t)waveform[index] : waveform[index];
        if (value > waveform_peak) waveform_peak = value;
    }
    printf("transmitting %u bytes as %d samples waveform_peak=%lld...\n",
           (unsigned)payload_size, encoded_samples, (long long)waveform_peak);
    hardware_mute_mic();
    esp_err_t result = hardware_play_pcm(waveform, (size_t)encoded_samples);
    if (result == ESP_OK) result = hardware_stop_pcm();
    hardware_unmute_mic();
    heap_caps_free(waveform);
    printf("result=%s\n", esp_err_to_name(result));
    return result == ESP_OK ? 0 : 1;
}

static int cmd_ggtest(int argc, char **argv)
{
    (void)argc;
    (void)argv;
    const int result = ggwave_transport_self_test();
    printf("ggwave_self_test=%d\n", result);
    return result == 0 ? 0 : 1;
}

static int cmd_crypto_test(int argc, char **argv)
{
    (void)argc;
    (void)argv;
    const esp_err_t result = keystore_crypto_self_test();
    printf("crypto_self_test=%s\n", esp_err_to_name(result));
    return result == ESP_OK ? 0 : 1;
}

static int cmd_diag(int argc, char **argv)
{
    (void)argc;
    (void)argv;
    const int mic_result = cmd_mic(0, NULL);
    ggwave_transport_log_status();
    return mic_result;
}

static int cmd_rx(int argc, char **argv)
{
    const int seconds = argc == 1 ? 10 : atoi(argv[1]);
    if (argc > 2 || seconds <= 0 || seconds > 60) {
        printf("usage: rx [seconds 1-60]\n");
        return 1;
    }

    static int32_t raw_samples[512];
    static int16_t samples[512];
    static uint8_t payload[256];
    int64_t raw_peak = 0;
    int64_t pcm_peak = 0;
    const int64_t deadline = esp_timer_get_time() + (int64_t)seconds * 1000000;
    printf("listening for %d seconds...\n", seconds);
    while (esp_timer_get_time() < deadline) {
        size_t samples_read = 0;
        const esp_err_t result = hardware_read_mic(raw_samples, 512, &samples_read, 500);
        if (result != ESP_OK) {
            printf("microphone read failed: %s\n", esp_err_to_name(result));
            return 1;
        }
        for (size_t index = 0; index < samples_read; index++) {
            int64_t raw_value = raw_samples[index] < 0 ? -(int64_t)raw_samples[index] : raw_samples[index];
            if (raw_value > raw_peak) raw_peak = raw_value;
            samples[index] = mic_sample_to_pcm(raw_samples[index]);
            int64_t value = samples[index] < 0 ? -(int64_t)samples[index] : samples[index];
            if (value > pcm_peak) pcm_peak = value;
        }

        const int decoded = ggwave_transport_decode(samples, samples_read, payload, sizeof(payload));
        if (decoded > 0) {
            char decoded_text[257] = {0};
            const int text_length = decoded < (int)sizeof(decoded_text) - 1 ? decoded : (int)sizeof(decoded_text) - 1;
            for (int index = 0; index < text_length; index++) {
                decoded_text[index] = (payload[index] >= 32 && payload[index] <= 126)
                    ? (char)payload[index]
                    : '.';
            }
            printf("received %d bytes text=\"%s\" hex=", decoded, decoded_text);
            for (int index = 0; index < decoded; index++) printf("%02x", payload[index]);
            printf("\n");
            (void)display_text(decoded_text);
            ggwave_transport_log_status();
            return 0;
        }
    }

    printf("no payload received raw_peak=%lld pcm_peak=%lld\n",
           (long long)raw_peak, (long long)pcm_peak);
    ggwave_transport_log_status();
    return 1;
}

static void init_console(void)
{
    const esp_console_cmd_t tone_command = {
        .command = "tone",
        .help = "play a one-second tone and sample the microphone",
        .hint = NULL,
        .func = &cmd_tone,
    };
    const esp_console_cmd_t button_command = {
        .command = "button_test",
        .help = "wait for the GPIO10 approval button",
        .hint = "[seconds]",
        .func = &cmd_button_test,
    };
    const esp_console_cmd_t mic_command = {
        .command = "mic",
        .help = "read microphone samples and peak level",
        .hint = NULL,
        .func = &cmd_mic,
    };
    const esp_console_cmd_t micplay_command = {
        .command = "micplay",
        .help = "record the microphone, then play it back",
        .hint = "[seconds]",
        .func = &cmd_micplay,
    };
    const esp_console_cmd_t oled_command = {
        .command = "oled",
        .help = "redraw OLED test pattern",
        .hint = NULL,
        .func = &cmd_oled,
    };
    const esp_console_cmd_t screen_command = {
        .command = "screen",
        .help = "display typed text on the OLED",
        .hint = "<text>",
        .func = &cmd_screen,
    };
    const esp_console_cmd_t warp_command = {
        .command = "oled_warp",
        .help = "play or show a success warp animation frame",
        .hint = "[frame]",
        .func = &cmd_oled_warp,
    };
    const esp_console_cmd_t check_command = {
        .command = "oled_check",
        .help = "play or show a checkmark animation frame",
        .hint = "[frame]",
        .func = &cmd_oled_check,
    };
    const esp_console_cmd_t success_command = {
        .command = "oled_success",
        .help = "show the final payment success layout",
        .hint = NULL,
        .func = &cmd_oled_success,
    };
    const esp_console_cmd_t tx_command = {
        .command = "tx",
        .help = "transmit a text payload over audio",
        .hint = NULL,
        .func = &cmd_tx,
    };
    const esp_console_cmd_t ggtest_command = {
        .command = "ggtest",
        .help = "encode and decode a ggwave waveform in memory",
        .hint = NULL,
        .func = &cmd_ggtest,
    };
    const esp_console_cmd_t crypto_test_command = {
        .command = "crypto_self_test",
        .help = "run Keccak, signing, and transaction vectors",
        .hint = NULL,
        .func = &cmd_crypto_test,
    };
    const esp_console_cmd_t diag_command = {
        .command = "diag",
        .help = "print microphone and ggwave diagnostics",
        .hint = NULL,
        .func = &cmd_diag,
    };
    const esp_console_cmd_t api_command = {
        .command = "api",
        .help = "send a structured JSON device request",
        .hint = "<json>",
        .func = &device_api_command,
    };
    const esp_console_cmd_t acoustic_command = {
        .command = "acoustic",
        .help = "capture the speaker waveform and run it through ggwave",
        .hint = NULL,
        .func = &cmd_acoustic,
    };
    const esp_console_cmd_t rx_command = {
        .command = "rx",
        .help = "listen for an audio payload",
        .hint = "[seconds]",
        .func = &cmd_rx,
    };

    ESP_ERROR_CHECK(esp_console_register_help_command());
    ESP_ERROR_CHECK(esp_console_cmd_register(&tone_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&button_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&mic_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&micplay_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&oled_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&screen_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&warp_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&check_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&success_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&tx_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&ggtest_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&crypto_test_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&diag_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&api_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&acoustic_command));
    ESP_ERROR_CHECK(esp_console_cmd_register(&rx_command));

    esp_console_repl_t *repl = NULL;
    esp_console_repl_config_t repl_config = ESP_CONSOLE_REPL_CONFIG_DEFAULT();
    repl_config.prompt = "melodypay> ";
    repl_config.max_cmdline_length = 2048;
    repl_config.max_cmdline_args = 16;
    repl_config.task_stack_size = 8192;
    esp_console_dev_uart_config_t uart_config = ESP_CONSOLE_DEV_UART_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_console_new_repl_uart(&uart_config, &repl_config, &repl));
    ESP_ERROR_CHECK(esp_console_start_repl(repl));
}

void app_main(void)
{
    ESP_ERROR_CHECK(nvs_flash_init());
    ESP_ERROR_CHECK(button_init());
    ESP_ERROR_CHECK(hardware_init());
    ESP_ERROR_CHECK(ggwave_transport_init());
    ESP_ERROR_CHECK(display_init());
    const esp_err_t keystore_result = keystore_init();
    if (keystore_result != ESP_OK) {
        ESP_LOGE(TAG, "keystore initialization failed: %s; wallet signing disabled", esp_err_to_name(keystore_result));
    }
    wallet_state_init();

    boot_audio_running = true;
    boot_audio_done = false;
    if (xTaskCreate(boot_chime_task, "boot_chime", 3072, NULL, 4, NULL) != pdPASS) {
        ESP_LOGW(TAG, "boot chime task could not start");
        boot_audio_running = false;
        boot_audio_done = true;
    }
    display_boot_animation();
    boot_audio_running = false;
    while (!boot_audio_done) vTaskDelay(pdMS_TO_TICKS(10));
    display_home_screen(0);
    ESP_LOGI(TAG, "OLED connected: %s", display_is_connected() ? "yes" : "no");
    ESP_LOGI(TAG, "audio self-test result: %s", esp_err_to_name(hardware_run_audio_self_test()));
    ESP_LOGI(TAG, "wallet state initialized: %d", wallet_state_get());
    init_console();

    while (true) {
        if (wallet_state_get() != WALLET_REVIEW && wallet_state_get() != WALLET_APPROVED &&
            wallet_state_get() != WALLET_TRANSMITTING) {
            handle_ui_event(button_poll_event());
        }
        vTaskDelay(pdMS_TO_TICKS(50));
    }
}
