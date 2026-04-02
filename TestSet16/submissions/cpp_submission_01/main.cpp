#include "record_store.hpp"

#include <iostream>
#include <string>
#include <vector>

static int menu() {
    int choice = -1;
    std::cout << "\nRecord Manager\n";
    std::cout << "1) Load CSV\n";
    std::cout << "2) Add/Update\n";
    std::cout << "3) Delete\n";
    std::cout << "4) List\n";
    std::cout << "5) Filter by major\n";
    std::cout << "6) Save CSV\n";
    std::cout << "0) Exit\n";
    std::cout << "Choice: ";
    std::cin >> choice;
    std::cin.ignore();
    return choice;
}

int main() {
    std::vector<StudentRecord> records;
    bool running = true;

    while (running) {
        int choice = menu();
        if (choice == 1) {
            std::string file;
            std::cout << "Input CSV: ";
            std::getline(std::cin, file);
            std::cout << (loadRecordsCsv(file, records) ? "loaded\n" : "load failed\n");
        } else if (choice == 2) {
            StudentRecord row{};
            std::cout << "ID: "; std::cin >> row.id; std::cin.ignore();
            std::cout << "Name: "; std::getline(std::cin, row.name);
            std::cout << "Major: "; std::getline(std::cin, row.major);
            std::cout << "Year: "; std::cin >> row.year;
            std::cout << "GPA: "; std::cin >> row.gpa; std::cin.ignore();
            addOrUpdateRecord(records, row);
        } else if (choice == 3) {
            int id = 0;
            std::cout << "Delete ID: ";
            std::cin >> id;
            std::cin.ignore();
            std::cout << (deleteRecord(records, id) ? "removed\n" : "not found\n");
        } else if (choice == 4) {
            sortById(records);
            printRecords(records);
        } else if (choice == 5) {
            std::string major;
            std::cout << "Major filter: ";
            std::getline(std::cin, major);
            auto filtered = filterByMajor(records, major);
            printRecords(filtered);
        } else if (choice == 6) {
            std::string file;
            std::cout << "Output CSV: ";
            std::getline(std::cin, file);
            std::cout << (saveRecordsCsv(file, records) ? "saved\n" : "save failed\n");
        } else if (choice == 0) {
            running = false;
        } else {
            std::cout << "Invalid option\n";
        }
    }

    return 0;
}
