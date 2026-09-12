idf_component_register(
    SRCS "evm_tx.c" "evm_self_test.c" "keccak.c"
    INCLUDE_DIRS "include"
    REQUIRES mbedtls
)
