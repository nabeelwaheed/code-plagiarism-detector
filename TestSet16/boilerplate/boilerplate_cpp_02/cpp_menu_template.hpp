#ifndef CPP_MENU_TEMPLATE_HPP
#define CPP_MENU_TEMPLATE_HPP

#include <string>
#include <vector>

struct CppMenuItem {
    int id;
    std::string label;
};

void printCppMenu(const std::string &title, const std::vector<CppMenuItem> &items);

#endif
