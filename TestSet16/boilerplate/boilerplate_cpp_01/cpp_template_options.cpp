#include "cpp_template_options.hpp"

#include <string>

bool parseCppTemplateOptions(int argc, char **argv, CppTemplateOptions &options) {
    options.inputPath.clear();
    options.outputPath.clear();
    options.verbose = false;

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "-i" && i + 1 < argc) {
            options.inputPath = argv[++i];
        } else if (arg == "-o" && i + 1 < argc) {
            options.outputPath = argv[++i];
        } else if (arg == "-v") {
            options.verbose = true;
        } else {
            return false;
        }
    }

    return !options.inputPath.empty();
}
