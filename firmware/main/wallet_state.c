#include "wallet_state.h"

static wallet_state_t current_state = WALLET_IDLE;

void wallet_state_init(void)
{
    current_state = WALLET_IDLE;
}

wallet_state_t wallet_state_get(void)
{
    return current_state;
}

void wallet_state_set(wallet_state_t state)
{
    current_state = state;
}
