#ifndef CPP_TEMPLATE_OPTIONS_HPP
#define CPP_TEMPLATE_OPTIONS_HPP

#include <string>

struct CppTemplateOptions {
    std::string inputPath;
    std::string outputPath;
    bool verbose;
};

bool parseCppTemplateOptions(int argc, char **argv, CppTemplateOptions &options);

#endif
