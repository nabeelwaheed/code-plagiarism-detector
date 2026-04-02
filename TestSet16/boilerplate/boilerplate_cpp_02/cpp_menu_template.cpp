#include "cpp_menu_template.hpp"

#include <iostream>

void printCppMenu(const std::string &title, const std::vector<CppMenuItem> &items) {
    std::cout << "\n=== " << title << " ===\n";
    for (const auto &item : items) {
        std::cout << item.id << ") " << item.label << "\n";
    }
}
