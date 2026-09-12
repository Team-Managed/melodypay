idf_component_register(
    SRCS "ggwave_transport.cpp" "vendor/ggwave/src/ggwave.cpp"
    INCLUDE_DIRS "include" "vendor/ggwave/include"
)

target_compile_features(${COMPONENT_LIB} PRIVATE cxx_std_11)
# Upstream ggwave logs a size_t with an int format in one diagnostic path.
target_compile_options(${COMPONENT_LIB} PRIVATE -Wno-format)
