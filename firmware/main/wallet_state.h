#pragma once

typedef enum {
    WALLET_IDLE = 0,
    WALLET_RECEIVING,
    WALLET_REVIEW,
    WALLET_APPROVED,
    WALLET_TRANSMITTING,
    WALLET_ERROR,
} wallet_state_t;

void wallet_state_init(void);
wallet_state_t wallet_state_get(void);
void wallet_state_set(wallet_state_t state);
