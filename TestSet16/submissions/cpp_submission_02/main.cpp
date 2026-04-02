#include "student_db.hpp"

#include <iostream>
#include <string>
#include <vector>

static int prompt() {
    int c = -1;
    std::cout << "\nStudent DB Console\n";
    std::cout << "1) Import CSV\n2) Insert/Replace\n3) Remove\n4) Show\n5) Show by Program\n6) Export CSV\n0) Exit\n";
    std::cout << "Select: ";
    std::cin >> c;
    std::cin.ignore();
    return c;
}

int main() {
    std::vector<Learner> rows;
    bool keep = true;

    while (keep) {
        int cmd = prompt();
        switch (cmd) {
            case 1: {
                std::string file;
                std::cout << "CSV input: ";
                std::getline(std::cin, file);
                std::cout << (importCsv(file, rows) ? "imported\n" : "import failed\n");
                break;
            }
            case 2: {
                Learner one{};
                std::cout << "SID: "; std::cin >> one.sid; std::cin.ignore();
                std::cout << "Name: "; std::getline(std::cin, one.fullName);
                std::cout << "Program: "; std::getline(std::cin, one.program);
                std::cout << "Level: "; std::cin >> one.level;
                std::cout << "CGPA: "; std::cin >> one.cgpa; std::cin.ignore();
                upsertLearner(rows, one);
                break;
            }
            case 3: {
                int sid;
                std::cout << "SID to remove: ";
                std::cin >> sid;
                std::cin.ignore();
                std::cout << (eraseLearner(rows, sid) ? "removed\n" : "missing\n");
                break;
            }
            case 4:
                orderBySid(rows);
                printTable(rows);
                break;
            case 5: {
                std::string program;
                std::cout << "Program name: ";
                std::getline(std::cin, program);
                auto subset = whereProgram(rows, program);
                printTable(subset);
                break;
            }
            case 6: {
                std::string file;
                std::cout << "CSV output: ";
                std::getline(std::cin, file);
                std::cout << (exportCsv(file, rows) ? "exported\n" : "export failed\n");
                break;
            }
            case 0:
                keep = false;
                break;
            default:
                std::cout << "Unknown command\n";
                break;
        }
    }

    return 0;
}
